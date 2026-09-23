import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getCurrentUser, setCurrentUser, useCurrentUser } from '@family-home/shared/auth';
import {
  createUser,
  deleteUser,
  fetchMe,
  fetchProfile,
  listUserOptions,
  listUsers,
  updatePassword,
  updateProfile,
  updateUserRole,
  type UserCreateInput,
  type UserRole,
} from '../../api/user';
import { useApiMutation } from '../../hooks/useApiMutation';

/**
 * 账号域的数据层。
 *
 * 三个 queryKey 各有用处：
 * - `['user','options']` 是全端共用的 id → 昵称字典。七处"添加人"都读它，
 *   所以后端才刻意让这个接口只给 id 和昵称（见 UserOptionVO）——一本会被到处 import 的字典。
 * - `['user','list']` 只有账号管理页用（带手机号，ADMIN 才拿得到）。
 * - `['user','profile']` 只有个人中心页用（当前这个人自己的手机号）。
 *
 * 写操作统一走 useApiMutation，失效键都填 `['user']` 这个前缀：改完昵称，
 * 各处"添加人"和账号管理页的表格要一起刷新，列两个 key 容易漏掉一个。
 */
const OPTIONS_KEY = ['user', 'options'] as const;
const LIST_KEY = ['user', 'list'] as const;
const PROFILE_KEY = ['user', 'profile'] as const;
const USER_FAMILY = ['user'] as const;

export function useUserOptions() {
  return useQuery({
    queryKey: OPTIONS_KEY,
    queryFn: listUserOptions,
    // 成员名单改动极少，而它是"添加人"那一列的前置依赖：宁可长缓存，也别每次翻页都打一次字典。
    staleTime: 5 * 60_000,
  });
}

/** 账号管理页的表格数据。enabled 给"非管理员不发请求"用（服务端照样会 403） */
export function useUsers(enabled = true) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: listUsers,
    enabled,
  });
}

export function useCreateUser() {
  return useApiMutation((input: UserCreateInput) => createUser(input), {
    invalidate: [USER_FAMILY],
    // 这一句是全系统唯一一次把初始口令显示出来：它是后端写死的全家统一值
    // （AppUserService#DEFAULT_INITIAL_PASSWORD），不是"某个人的密码"——表单上没有密码框、
    // 接口不收口令，管理员也改不了任何人的口令。提示放这里而不是弹窗里，是为了让
    // "建完号要告诉本人第一次用什么登"这件事正好发生在建完那一刻。
    successMessage: '账号已创建，初始密码 123456',
  });
}

export function useDeleteUser() {
  return useApiMutation(
    async (id: number) => {
      await deleteUser(id);
      // 被删的如果是自己：/me 会 401，http 层随即清掉登录态，页面掉回登录页。
      // 不清的话界面上还挂着一个人已经消失的身份，要等下一个请求才反应过来。
      if (getCurrentUser()?.id === id) await refreshMe();
    },
    { invalidate: [USER_FAMILY], successMessage: '账号已删除' },
  );
}

/**
 * 管理员把某个人设成超管 / 撤回。角色是这一版**唯一**由管理员替别人决定的字段
 * （昵称/手机号/口令三项仍然只有本人一个入口）。
 *
 * 自己那一行不给这个开关（前端不摆、后端也挡），所以这一条永远不会改动当前登录者的角色，
 * 本机那一格 `{role}` 因此不需要 refreshMe——与 useUpdatePassword 同理，什么都不用额外刷。
 * 被改的那个人看到的是下一次 /me 校准（进页面时），不需要重新登录。
 */
export function useUpdateUserRole() {
  return useApiMutation(
    (input: { id: number; role: UserRole }) => updateUserRole(input.id, input.role),
    { invalidate: [USER_FAMILY], successMessage: '角色已更新' },
  );
}

/**
 * 拿服务端最新的"我是谁"覆盖本机缓存那一格。
 *
 * 缓存只是"上次登录过谁"，而昵称/手机号/头像可能被这个人自己在个人中心改掉（全系统只有那一个入口），
 * 角色可能被某个管理员在账号管理页切换掉（别人那一行的开关）——
 * 所以进页面时以服务端为准，别信本机那一格。被提权/降权的人不需要重新登录，这一次校准就够了。
 * 账号被删时 /me 返 401，lib/http 的响应拦截器会清缓存，登录门槛随即把页面换回登录页。
 */
export async function refreshMe(): Promise<void> {
  const identity = getCurrentUser();
  if (!identity) return;
  try {
    const current = await fetchMe();
    // 注销或重新登录之后，旧请求不得覆盖新登录态。
    if (getCurrentUser() === identity) setCurrentUser(current);
  } catch {
    // 后端没起来/网络抖动：继续用本机那一格，别把已经登录的状态清掉
  }
}

/** 挂载时用 /me 校准一次（重新登录后 id 变了，也会再来一次） */
export function useSyncMe(userId?: number): void {
  useEffect(() => {
    if (userId != null) void refreshMe();
  }, [userId]);
}

/**
 * 个人中心（`/profile`）的数据层：读自己的资料 + 改资料 + 改密码。
 *
 * 【为什么登录后还要单独拉一次 profile】本机那一格 `{id,name,role,avatarUrl}` 刻意不带手机号
 * （它只是个"上次登录过谁"的缓存，不该存凭据类信息），所以这一页要什么就从服务端再取一次。
 *
 * 【改完昵称要顺手 refreshMe】昵称同时挂在侧栏/顶栏那一栏（useCurrentUser 驱动），
 * 只失效查询缓存的话，页面标题变了、侧栏还挂着旧名字，要等下次刷新才对齐。
 *
 * 【改密码不动任何缓存】登录态就是一个 id，换口令不会让它失效；
 * 所以改完不需要重新登录，也没有任何一屏数据需要刷新。
 */
export function useProfile() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: [...PROFILE_KEY, user?.id],
    queryFn: fetchProfile,
    enabled: user != null,
  });
}

export function useUpdateProfile() {
  return useApiMutation(
    async (input: { name: string; phone: string; avatarFileId?: number | null }) => {
      await updateProfile(input);
      // 改完顺手 refreshMe：昵称和头像都挂在侧栏/顶栏那一栏（useCurrentUser 驱动），
      // 只失效查询缓存的话，页面变了、侧栏还挂着旧名字旧头像，要等下次刷新才对齐。
      await refreshMe();
    },
    { invalidate: [USER_FAMILY], successMessage: '资料已保存' },
  );
}

export function useUpdatePassword(onSuccess?: () => void) {
  return useApiMutation(
    (input: { oldPassword: string; newPassword: string }) => updatePassword(input),
    { successMessage: '密码已修改', onSettledSuccess: onSuccess },
  );
}
