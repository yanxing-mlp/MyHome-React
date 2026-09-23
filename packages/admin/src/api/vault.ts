import { del, get, post, put, toQuery, withIdentity } from '../lib/http';
import type { DataScope } from '../lib/http';
import type { AxiosRequestConfig } from 'axios';
import { decryptPassword, encryptPassword } from '@family-home/shared/crypto';
import type { PageRequest, PageResult } from '@family-home/shared/http';

/** 对应后端 VaultAccountAdminVO —— **没有**密码字段，口令只能走 reveal */
export interface VaultAccount {
  id: number;
  scope: DataScope;
  ownerId: number | null;
  /** 平台名，如 微信 / steam / QQ */
  name: string;
  account: string;
  /** 添加人（app_user.id）；接口不返回口令，只返回是谁加的 */
  creatorId?: number | null;
  createTime: string;
  updateTime: string;
}

export interface VaultAccountInput {
  name: string;
  account: string;
  /**
   * 明文口令，由本文件的 `createVaultAccount` / `updateVaultAccount` 在发请求前加密。
   * 留空表示"不改密码"（后端按 NOT_NULL 更新策略跳过该列）——注意判空判的是**明文**，
   * 也就是页面那侧的语义，加密后的串永远非空，判在密文上会失效。
   */
  password?: string;
}

export interface VaultAccountQuery extends PageRequest {
  scope?: DataScope;
  /** 命中 name 或 account，后端是 LIKE '%kw%' */
  keyword?: string;
}

export function fetchVaultAccounts(
  query: VaultAccountQuery,
  config: AxiosRequestConfig = withIdentity(),
): Promise<PageResult<VaultAccount>> {
  return get<PageResult<VaultAccount>>(`/api/b/vault/accounts${toQuery({ ...query, scope: query.scope ?? 'PUBLIC' })}`, config);
}

export async function createVaultAccount(
  input: VaultAccountInput,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<number> {
  return post<number>(`/api/b/vault/accounts${toQuery({ scope })}`, {
    ...input, password: await encryptPassword(input.password ?? ''),
  }, config);
}

export async function updateVaultAccount(
  id: number,
  input: VaultAccountInput,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return put<void>(`/api/b/vault/accounts/${id}${toQuery({ scope })}`, {
    ...input,
    password: input.password ? await encryptPassword(input.password) : undefined,
  }, config);
}

/** 两态软删（后端 @TableLogic），列表与 reveal 都立刻查不到 */
export function deleteVaultAccount(
  id: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return del<void>(`/api/b/vault/accounts/${id}${toQuery({ scope })}`, config);
}

/**
 * 取回口令，**返回的就是解密后的明文**（对页面来说接口形状没变，v11 加的只是 wire 上那一层）。
 *
 * 用 POST 而不是 GET：GET 的 URL（含 id）会进 nginx access log 和浏览器历史，
 * 口令类动作不留这种痕迹。响应体里那一格是传输层密文，解出来的明文**不要**写进
 * state 之外的地方（不落 localStorage、不打日志）。
 */
export async function revealVaultPassword(
  id: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<{ id: number; password: string }> {
  const data = await post<{ id: number; password: string }>(
    `/api/b/vault/accounts/${id}/password/reveal${toQuery({ scope })}`, undefined, config,
  );
  return { id: data.id, password: await decryptPassword(data.password) };
}
