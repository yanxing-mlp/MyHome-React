import { useQuery } from '@tanstack/react-query';
import { fetchRoleMatrix, saveRoleMatrix } from '../../api/role';
import { useApiMutation } from '../../hooks/useApiMutation';

/**
 * 角色权限矩阵的数据层。
 *
 * 读整张矩阵（GET，要 role.access）+ 保存某个角色的完整勾选（PUT，只有超管）。
 * 失效键用 `['role']` 前缀：保存完重新拉一次矩阵，让勾选态与服务端对齐（虽然本地 draft 已经是最新，
 * 但服务端可能因并发被另一个超管改过，以回读为准最稳）。
 */
const MATRIX_KEY = ['role', 'matrix'] as const;
const ROLE_FAMILY = ['role'] as const;

export function useRoleMatrix(enabled = true) {
  return useQuery({
    queryKey: MATRIX_KEY,
    queryFn: fetchRoleMatrix,
    enabled,
  });
}

export function useSaveRoleMatrix() {
  return useApiMutation(
    (input: { role: string; codes: string[] }) => saveRoleMatrix(input.role, input.codes),
    { invalidate: [ROLE_FAMILY], successMessage: '权限已保存' },
  );
}
