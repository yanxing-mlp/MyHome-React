import { useSyncExternalStore } from 'react';

/**
 * 「当前登录的是谁」这一格状态，B/C 两端共用一份。
 *
 * 【为什么放 shared 而不是各端一个 Provider】
 * 要写的东西完全一样（localStorage 读写 + 请求头取值 + 一个订阅 hook），两端各写一份必然会漂移；
 * 而 Context 方案还得在两边各挂一个 Provider、各写一次 useContext。
 * 用模块级单例 + useSyncExternalStore：import 进来就能订阅，谁都不必先包一层壳。
 *
 * 【这一格现在存两样东西：展示用的账号 + 一枚登录令牌】
 * 早期版本没有令牌，身份就是请求头 X-User-Id——谁都能手搓一个冒充大宝，是个越权洞。
 * 现在改成：登录成功时后端用 HMAC 签一枚令牌（{@code SessionToken}）随返回体给前端，
 * 前端把令牌存进 {@code fh-auth-token}、之后每个请求放进 {@code Authorization: Bearer <token>} 头，
 * 后端验签验有效期后才认这个人。令牌<b>由服务端签名、改一个字节就验不过</b>，
 * 所以本机缓存被手改不再等价于"换一个身份"——这正是那次修复的落点。
 *
 * 【令牌与展示对象分开存】
 * 展示对象（id/昵称/角色/头像）会被 `/me` 的返回整格覆盖（refreshMe），而 `/me` 不带令牌；
 * 若把令牌塞进同一个对象，一次校准就会把它抹掉。所以令牌单独一格、单独一个 localStorage 键，
 * `setCurrentUser` 只动展示对象、`clearCurrentUser` 才把两样一起清掉。
 *
 * 【令牌是凭据，展示对象不是】
 * 令牌等同"这次登录的钥匙"，别把它写进日志、query cache 或任何会被持久化/上报的地方；
 * 展示对象里也刻意没有手机号与口令（见 CurrentUser）。
 *
 * 【"登录一次即可"落在代码上就是这里】
 * 登录成功写一次（令牌 + 展示对象），之后每次请求都从令牌那一格取值；退出/401 才一起清掉。
 * 令牌 7 天到期，到期后任意请求返 401，同样落到清缓存 → 回登录页。
 */

/** 请求头名。与后端 {@code CurrentUserHolder.AUTH_HEADER} 是同一个字符串，两端各自的 HTTP 层统一注入。 */
export const AUTH_HEADER = 'Authorization';
/** Bearer 前缀。与后端 {@code CurrentUserHolder.BEARER_PREFIX} 逐字对齐，拼接时不要漏掉末尾空格。 */
export const BEARER_PREFIX = 'Bearer ';

/** 展示对象的本地缓存键。两端跑在不同端口（5173 / 5174），各自的 localStorage 互不影响。 */
const STORAGE_KEY = 'fh-current-user';
/** 登录令牌的本地缓存键，与展示对象分开存（理由见文件头）。 */
const TOKEN_STORAGE_KEY = 'fh-auth-token';

export type UserRole = 'ADMIN' | 'MEMBER';

/**
 * 当前用户（展示用）。
 *
 * 只有展示要用的四个字段：id 拿去做"身份有没有切换"的比对锚点，name/avatarUrl 拿去渲染右下角那一块，
 * role 拿去决定「账号管理」菜单露不露。
 * 刻意没有 phone：它是个人资料项（V502 起连登录都不再核对它），要用的人自己去 /profile 取。
 * 也没有 password / token：这一格只是"上次登录过谁"的展示快照，凭据一个字节都不该出现——
 * 令牌单独存（见 getAuthToken），多塞一份只是多一个泄漏面。
 */
export interface CurrentUser {
  id: number;
  name: string;
  role: UserRole;
  /** null = 没设过头像，各处用 DEFAULT_USER_AVATAR 兜底 */
  avatarUrl: string | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();

/** undefined = 还没读过 localStorage（首次访问才读，避免模块加载期碰浏览器 API） */
let cached: CurrentUser | null | undefined;
/** 登录令牌的模块级快照，与 cached 同一套"首次才读"的懒加载口径 */
let cachedToken: string | null | undefined;

function normalize(raw: unknown): CurrentUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const user = raw as Partial<CurrentUser>;
  if (typeof user.id !== 'number' || typeof user.name !== 'string') return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
    avatarUrl: typeof user.avatarUrl === 'string' ? user.avatarUrl : null,
  };
}

function readStorage(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    // 隐私模式读 localStorage 会抛，或有人手动塞了脏 JSON：当作没登录，别白屏
    return null;
  }
}

/** 只落展示用的四个字段：即便调用方把带 token 的登录返回体整个丢进来，令牌也不会混进这一格。 */
function writeStorage(user: CurrentUser | null): void {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 写不进去只是下次进来要重选一次，本次登录照常可用
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // 同上：存不下只是下次要重新登录
  }
}

/** 快照读取。identity 稳定很重要：useSyncExternalStore 每次拿到新对象会无限重渲染。 */
function getSnapshot(): CurrentUser | null {
  if (cached === undefined) cached = readStorage();
  return cached;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 非 hook 场景（HTTP 拦截器）取值 */
export function getCurrentUser(): CurrentUser | null {
  return getSnapshot();
}

/**
 * "身份有没有切换"的比对锚点：当前账号的 id 字符串，没登录时为 null。
 *
 * 它<b>不再被当成请求头送出去</b>（那是旧 X-User-Id 的越权洞）；现在只用于异步操作的跨账号取消判断——
 * 捕获发起时的 id，回来时若已换人（id 变了）就丢弃这次结果。真正上线的身份是令牌（getAuthToken）。
 */
export function getCurrentUserId(): string | null {
  const user = getSnapshot();
  return user ? String(user.id) : null;
}

/** 登录令牌；没登录时为 null，由调用方决定"不带 Authorization 头"。这是上线身份的唯一来源。 */
export function getAuthToken(): string | null {
  if (cachedToken === undefined) cachedToken = readToken();
  return cachedToken;
}

/** 登录成功时写入后端签发的令牌。与 setCurrentUser 成对调用（见各端登录页）。 */
export function setAuthToken(token: string | null): void {
  cachedToken = token;
  writeToken(token);
}

export function setCurrentUser(user: CurrentUser): void {
  // normalize 一遍：只留展示用的四个字段，避免登录返回体里的 token 混进展示缓存
  cached = normalize(user) ?? user;
  writeStorage(cached);
  emit();
}

/**
 * 退出/被 401 打回时调；下一次进页面就会落到登录页。<b>展示对象与令牌一起清</b>——
 * 只清一个都会留下"看着登录了但请求全 401"或"有令牌却显示未登录"的错位状态。
 *
 * 「改的就是当前登录的人」时展示对象怎么跟着变：走 `useUsers.ts` 的 `refreshMe()`，
 * 拿服务端现值整格覆盖（顺带把头像/角色一起校准），比在这里拼一份 patch 更不容易漏字段；
 * 那一条只覆盖展示对象、不动令牌（`/me` 不返回令牌）。
 * 所以本模块写展示对象的入口只有两个：`setCurrentUser`（登录成功、`refreshMe`）与本函数。
 */
export function clearCurrentUser(): void {
  cached = null;
  cachedToken = null;
  writeStorage(null);
  writeToken(null);
  emit();
}

/** React 侧取值。返回 null 表示还没登录。 */
export function useCurrentUser(): CurrentUser | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
