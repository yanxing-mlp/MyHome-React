import { createAlbumGroup, updateAlbumGroup, batchUpdateGroupSort, deleteAlbumGroup } from '../../api/album';
import type { AlbumGroupScope, GroupSortItem } from '../../api/album';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useAlbumKeys } from './useAlbumGroups';

/** 创建分组；属主由服务端推导。 */
export function useCreateAlbumGroup(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async ({ name }: { name: string }) => {
      await createAlbumGroup({ name, scope });
    },
    {
      invalidate: [keys.root],
      successMessage: '已创建分组',
    },
  );
}

/** 重命名分组（只发 name，状态不动） */
export function useRenameAlbumGroup(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async ({ id, name }: { id: number; name: string }) => {
      await updateAlbumGroup(id, { name }, scope);
    },
    {
      invalidate: [keys.root],
      successMessage: '已重命名',
    },
  );
}

/** 批量更新分组排序（拖拽后一次性提交） */
export function useBatchUpdateGroupSort(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async (items: GroupSortItem[]) => {
      await batchUpdateGroupSort(items, scope);
    },
    {
      invalidate: [keys.root],
      successMessage: '排序已更新',
    },
  );
}

/** 删除分组，同时刷新图片与城市统计。 */
export function useDeleteAlbumGroup(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async (id: number) => {
      await deleteAlbumGroup(id, scope);
    },
    {
      invalidate: [keys.root],
      successMessage: '已删除分组',
    },
  );
}
