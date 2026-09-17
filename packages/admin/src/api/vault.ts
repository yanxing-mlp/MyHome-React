import { del, get, post, put, toQuery } from '@family-home/shared/http';
import type { PageRequest, PageResult } from '@family-home/shared/http';

/** 对应后端 VaultAccountAdminVO —— **没有**密码字段，明文只能走 reveal */
export interface VaultAccount {
  id: number;
  /** 平台名，如 微信 / steam / QQ */
  name: string;
  account: string;
  createTime: string;
  updateTime: string;
}

export interface VaultAccountInput {
  name: string;
  account: string;
  /** 编辑时留空表示"不改密码"（后端按 NOT_NULL 更新策略跳过该列） */
  password?: string;
}

export interface VaultAccountQuery extends PageRequest {
  /** 命中 name 或 account，后端是 LIKE '%kw%' */
  keyword?: string;
}

export function fetchVaultAccounts(query: VaultAccountQuery): Promise<PageResult<VaultAccount>> {
  return get<PageResult<VaultAccount>>(`/api/b/vault/accounts${toQuery({ ...query })}`);
}

export function createVaultAccount(input: VaultAccountInput): Promise<number> {
  return post<number>('/api/b/vault/accounts', input);
}

export function updateVaultAccount(id: number, input: VaultAccountInput): Promise<void> {
  return put<void>(`/api/b/vault/accounts/${id}`, input);
}

/** 两态软删（后端 @TableLogic），列表与 reveal 都立刻查不到 */
export function deleteVaultAccount(id: number): Promise<void> {
  return del<void>(`/api/b/vault/accounts/${id}`);
}

/**
 * 取明文口令。
 *
 * 用 POST 而不是 GET：GET 的 URL（含 id）会进 nginx access log 和浏览器历史，
 * 口令类动作不留这种痕迹。返回的明文**不要**写进任何 state 之外的地方（不落 localStorage、不打日志）。
 */
export function revealVaultPassword(id: number): Promise<{ id: number; password: string }> {
  return post<{ id: number; password: string }>(`/api/b/vault/accounts/${id}/password/reveal`);
}
