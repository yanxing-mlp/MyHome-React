/**
 * C 端的账号接口（后端 UserCController，`/api/c/user`）。
 *
 * 只有三个：登录页的下拉数据、登录、以及"开机对一下本机缓存还在不在"。
 * 账号管理是 B 端 ADMIN 的事，C 端连入口都没有——列表/新建/改角色/删除那四条，
 * 加上个人中心的三条自助接口，都只在 `/api/b/user/**` 上（C 端忘了口令得去 B 端改）。
 *
 * 这三条与 B 端同名接口共用同一套 service（昵称字典、登录校验、"用 id 换回现在的自己"各只有一份实现），
 * 但路径各走各的：C 端不拼 `/api/b/` 前缀，部署层才能按前缀分网段放行（方案 §8.3）。
 */
import type { CurrentUser } from '@family-home/shared/auth';
import { encryptPassword } from '@family-home/shared/crypto';
import { getJson, requestJson } from '../utils/request';

/** 登录页下拉框的一项，同时是"下单人是谁"那份昵称字典。后端刻意不给手机号。 */
export interface UserOption {
  id: number;
  name: string;
}

/**
 * 登录返回体：比展示用的 CurrentUser 多一格后端 HMAC 签发的登录令牌。
 * 令牌只随 `/login` 返回一次（`/me` 不带），前端存进 shared/auth 的令牌格，之后每个请求放进
 * `Authorization: Bearer` 头——取代旧那个可被手搓冒充的 X-User-Id。
 */
export type LoginResult = CurrentUser & { token: string | null };

export function listUserOptions(): Promise<UserOption[]> {
  return getJson<UserOption[]>('/api/c/user/options');
}

/**
 * 下拉选账号 + 填密码，成功返回展示用的那一格（id / 昵称 / 角色 / 头像）外加登录令牌。
 *
 * 密码不对时后端返回可直接展示的中文（USER_PASSWORD_MISMATCH，HTTP 400）；这一层不吞错误，
 * 登录页原样显示。与 B 端共用同一个 service，所以两端的登录口径必然一致——
 * 包括 v11 这层：出去的也是传输层密文，与 B 端同一个 `encryptPassword`、同一串盐。
 */
export async function login(userId: number, password: string): Promise<LoginResult> {
  return requestJson<LoginResult>('POST', '/api/c/user/login', {
    userId,
    password: await encryptPassword(password)
  });
}

/**
 * 用本机缓存的 id 换回"账号还在不在 + 现在的昵称/头像/角色"。
 *
 * 打开页面时发一次：账号在 B 端被改名或删掉，C 端不用再手动清缓存就能跟上
 * （401 由 utils/request 统一处理成"清掉当前账号"，下一帧自然回到登录页）。
 */
export function fetchMe(): Promise<CurrentUser> {
  return getJson<CurrentUser>('/api/c/user/me');
}
