/**
 * 账号接口（后端 UserController，`/api/b/user`）。
 *
 * 三个要点：
 * - 登录成功返回的不只是"一个 id"，还有后端 HMAC 签发的一枚登录令牌（`token`）：前端把令牌存进本机
 *   （shared/auth 的 `setAuthToken`），之后每个请求由 lib/http 注入 `Authorization: Bearer <token>`。
 *   这取代了旧那个可被前端手搓冒充的 X-User-Id（方案 §5.7 的"一期不做鉴权"到此彻底改成"服务端验签认人"）。
 * - `/options` 与 `/login` 是仅有的两个不需要身份的接口，登录页只依赖这两个。
 * - 账号管理那四个接口（列表/新建/改角色/删除）服务端都会再判一次 ADMIN，前端藏菜单只是体验，不是权限。
 *   这一版**没有"编辑账号"这一条**：管理员管的是名单（加人、删人）和"谁是超管"，
 *   但改不了任何人的资料与口令——那三项只有个人中心一个入口，且只能改自己的。
 *
 * 另一组是个人中心的三条 `/profile*`：改的是"自己"，只要身份不要 ADMIN（见后端 UserController 类注释）。
 * 昵称、手机号、口令三项在这里都只有本人一个入口。
 * 任何一条都不返回口令哈希——实体上标了 select=false，哈希出不了 DAO，连管理员都看不到。
 *
 * v11：下面两个带口令的函数（`login` / `updatePassword`）在发请求前会把明文加密成传输层密文，
 * 所以**口令字段出这一层就不再是明文**，页面里传进来的仍然是明文、不需要改。
 * 加密只放在 api 层而不是各个 onSubmit：全站的口令出入口就这五处，收在一处才好保证没有漏网的那条。
 */
import { del, get, post, put } from '../lib/http';
import { encryptPassword } from '@family-home/shared/crypto';
import type { CurrentUser } from '@family-home/shared/auth';
import { uploadImage } from './album';

/** 登录页下拉框 / "添加人"字典的一项。后端刻意不给手机号。 */
export interface UserOption {
  id: number;
  name: string;
}

/** 角色只有两档，取值与后端 `CurrentUserHolder.ROLE_ADMIN` / `ROLE_MEMBER` 逐字对齐 */
export type UserRole = 'ADMIN' | 'MEMBER';

/**
 * 账号管理页的一行（对应后端 UserAdminVO）。
 *
 * 这里**没有口令相关的任何一列**——不是前端不展示，是后端 VO 里就没有：实体上的
 * `passwordHash` 标了 `select = false`，哈希出不了 DAO，所以哪怕管理员拿到整张表也换不出口令。
 */
export interface UserAdmin {
  id: number;
  name: string;
  phone: string;
  /** ADMIN 可管理账号；MEMBER 看不到那个菜单。这一格是管理员唯一能替别人改的字段（`updateUserRole`） */
  role: UserRole;
  /** null = 从没设过，展示默认头像 */
  avatarUrl: string | null;
  createTime: string;
  updateTime: string;
}

/**
 * 个人中心的一行（对应后端 UserProfileVO）：能自己改的那几项（昵称/手机号/头像），没有角色。
 *
 * 比展示用的 CurrentUser 多一格 `avatarFileId`：换头像是"先上传拿 id、保存时把 id 提交回去"的两步，
 * 页面得知道"当前这张"是哪个文件，没换时原样带回（后端 null 就不动那一列，所以也只能换、不能清空）。
 * `avatarUrl` 只用于进页面时预览当前头像（优先缩略图，取不到就画默认剪影）。
 */
export interface UserProfile {
  id: number;
  name: string;
  phone: string;
  /** 当前头像的文件 id；null = 还没设过头像 */
  avatarFileId: number | null;
  /** 当前头像的访问地址（优先缩略图）；null 时前端画默认剪影 */
  avatarUrl: string | null;
}

/**
 * 新建账号的入参。
 *
 * 没有 role：新建恒为 MEMBER。不是"管理员定不了角色"，而是角色只有一个写入口——
 * 表格里那一格 `updateUserRole`，弹窗再放一格就是同一件事两条路（见后端 UserCreateRequest 注释）。
 * 也**没有 password**：初始口令由服务端给统一固定值，管理员从头到尾不接触任何人的口令，
 * 所以这一页连一个密码输入框都没有。当事人第一次登录后去个人中心自己换掉。
 */
export interface UserCreateInput {
  name: string;
  phone: string;
  /** 不传就是默认头像；建号时由管理员定一张，之后本人可在个人中心自己换（这是管理员唯一能替别人定的资料字段） */
  avatarFileId?: number;
}

/**
 * 登录/当前用户返回体（对应后端 UserBriefVO）。
 *
 * 比展示用的 CurrentUser 多一格 `token`：**只有 `/login` 会填**，`/me` 恒为 null——
 * 令牌只在登录那一刻签发一次，之后靠本机存的那枚续用，校准身份不需要重新发令牌。
 * 登录页拿到后把 token 交给 `setAuthToken`、其余四格交给 `setCurrentUser`（后者会自动剥掉 token）。
 */
export type UserBrief = CurrentUser & { token: string | null };

export function listUserOptions(): Promise<UserOption[]> {
  return get<UserOption[]>('/api/b/user/options');
}

/**
 * 下拉选账号 + 填密码。密码不对时后端返 USER_PASSWORD_MISMATCH（HTTP 400），
 * message 可直接展示；刻意不给 401 —— 401 在 lib/http 里等于"清登录态回登录页"。
 *
 * 送出去的是 `encryptPassword` 的结果（`base64(IV || 密文 || 标签)`），不是用户敲的那一串。
 * 它不做 trim，也不管长度：密文长度由 IV 与 Base64 决定，跟口令长短无关，
 * 6 位这条规则在后端解密之后才判（`AppUserService#requireNewPasswordLength`）。
 */
export async function login(userId: number, password: string): Promise<UserBrief> {
  return post<UserBrief>('/api/b/user/login', { userId, password: await encryptPassword(password) });
}

/** 用本机缓存的 id 换回"账号还在不在 + 现在的昵称/头像/角色" */
export function fetchMe(): Promise<UserBrief> {
  return get<UserBrief>('/api/b/user/me');
}

/** 个人中心的当前资料。只要身份不要 ADMIN，普通成员同样能读 */
export function fetchProfile(): Promise<UserProfile> {
  return get<UserProfile>('/api/b/user/profile');
}

/**
 * 改自己的昵称/手机号/头像。重名重号后端返 409/409。
 *
 * `avatarFileId` 为空 = 不改头像（后端 updateById 的 NOT_NULL 策略会跳过 null 列），
 * 所以这条只能换头像、清不掉头像。前端提交的恒是当前 state 里那个 id（没动过就是 profile 带回来的原 id）。
 */
export function updateProfile(input: { name: string; phone: string; avatarFileId?: number | null }): Promise<void> {
  return put<void>('/api/b/user/profile', input);
}

/**
 * 改自己的密码：必须带原密码（服务端拿它核对，不对就 USER_PASSWORD_MISMATCH）。
 * 两个字段各自加密（同一口令两次加密结果不同——IV 每次随机，这是应该的）。
 */
export async function updatePassword(input: { oldPassword: string; newPassword: string }): Promise<void> {
  return put<void>('/api/b/user/profile/password', {
    oldPassword: await encryptPassword(input.oldPassword),
    newPassword: await encryptPassword(input.newPassword)
  });
}

export function listUsers(): Promise<UserAdmin[]> {
  return get<UserAdmin[]>('/api/b/user');
}

export function createUser(input: UserCreateInput): Promise<number> {
  return post<number>('/api/b/user', input);
}

/**
 * 设置某个人的角色（ADMIN / MEMBER）——这一版**唯一**一个"管理员替别人决定"的字段。
 *
 * 它买到的只是"谁能进这一页"，买不到任何凭据：这一条改不了别人的昵称、手机号，更碰不到口令
 * （那三项仍然只有本人能在个人中心改）。后端挡住两种改法：改自己（"请让另一位管理员操作"）、
 * 把最后一个管理员降成普通成员（"至少保留一个管理员"），所以不存在"全家都没人能管账号"的状态。
 */
export function updateUserRole(id: number, role: UserRole): Promise<void> {
  return put<void>(`/api/b/user/${id}/role`, { role });
}

/**
 * 删除账号（软删）。管理员对"别人能不能登进来"的另一格控制权（与上一条一起构成全部）。
 *
 * 后端挡住删任何管理员账号（"请先取消其管理员角色"）——要删某个管理员，得先由另一位管理员
 * 把他降成普通成员，降下来那一行才会出现删除按钮；这一条也天然挡住了删自己（操作人必是管理员）。
 * 它同时也是"有人忘了口令"唯一的出路——这一版没有任何重置口令的接口，忘了只能删号重建
 * （代价：这个人在七处"添加人"里变成"已删除账号"）。
 */
export function deleteUser(id: number): Promise<void> {
  return del<void>(`/api/b/user/${id}`);
}

/**
 * 上传头像，返回新文件的 id 与访问地址（头像本身不直接存 URL：URL 会变，id 才是稳定的引用；
 * url 只是给弹窗里"传完立刻看到"那一步用）。
 *
 * 走的是相册那条通用上传接口，bizType 记成 USER_AVATAR；
 * 上传接口只收 jpeg/png/webp/gif，HEIC 由调用方先用 shared 的 compressImage 转码。
 */
export async function uploadAvatar(file: File): Promise<{ id: number; url?: string; thumbUrl?: string }> {
  const { id, url, thumbUrl } = await uploadImage(file, 'USER_AVATAR');
  return { id, url, thumbUrl };
}
