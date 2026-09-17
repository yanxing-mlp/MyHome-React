import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchVaultAccounts } from '../../api/vault';
import type { VaultAccountQuery } from '../../api/vault';

/** 列表及其派生查询的公共前缀。写操作成功后 invalidate 这一个 key 就够。 */
export const VAULT_ACCOUNTS_KEY = ['vault', 'accounts'] as const;

/**
 * 账号本列表查询。
 *
 * `placeholderData: keepPreviousData` —— 翻页/搜索时先保留上一页数据，
 * 不然每次切页都会闪一下空表，看起来像被删空了。
 */
export function useVaultAccounts(query: VaultAccountQuery) {
  return useQuery({
    queryKey: [...VAULT_ACCOUNTS_KEY, query],
    queryFn: () => fetchVaultAccounts(query),
    placeholderData: keepPreviousData,
  });
}
