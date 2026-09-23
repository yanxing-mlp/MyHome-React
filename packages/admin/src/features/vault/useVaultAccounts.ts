import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { fetchVaultAccounts } from '../../api/vault';
import type { VaultAccountQuery } from '../../api/vault';
import { withIdentity } from '../../lib/http';

/** 域前缀覆盖全部身份、分区和分页，写入后可靠刷新。 */
export const VAULT_ACCOUNTS_KEY = ['vault'] as const;

/** 不使用旧页占位数据，避免切换身份/分区时暂显上一份私人数据。 */
export function useVaultAccounts(query: VaultAccountQuery) {
  const user = useCurrentUser();
  const scope = query.scope ?? 'PUBLIC';
  return useQuery({
    queryKey: [...VAULT_ACCOUNTS_KEY, scope, user?.id ?? null, 'accounts', query],
    queryFn: ({ signal }) => fetchVaultAccounts({ ...query, scope }, {
      ...withIdentity(user ? String(user.id) : null), signal,
    }),
    enabled: !!user,
  });
}
