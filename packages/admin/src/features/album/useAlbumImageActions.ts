import { updateAlbumImage, toggleAlbumImagePin, deleteAlbumImage, batchDeleteAlbumImages } from '../../api/album';
import type { AlbumGroupScope, AlbumImageUpdateInput } from '../../api/album';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useAlbumKeys } from './useAlbumGroups';

/** 更新图片城市或状态，同步刷新当前域的图片、分组和城市。 */
export function useUpdateAlbumImage(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async ({ id, input }: { id: number; input: AlbumImageUpdateInput }) => {
      await updateAlbumImage(id, input, scope);
    },
    {
      invalidate: [keys.root],
      successMessage: '已更新',
    },
  );
}

/** 切换置顶状态 */
export function useToggleAlbumImagePin(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async ({ id, pinned }: { id: number; pinned: boolean }) => {
      await toggleAlbumImagePin(id, { pinned }, scope);
      return pinned;
    },
    {
      invalidate: [keys.root],
      successMessage: '操作成功',
    },
  );
}

/** 删除单张图片 */
export function useDeleteAlbumImage(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async (id: number) => {
      await deleteAlbumImage(id, scope);
    },
    {
      invalidate: [keys.root],
      successMessage: '已删除',
    },
  );
}

/** 批量删除图片 */
export function useBatchDeleteAlbumImages(scope: AlbumGroupScope) {
  const keys = useAlbumKeys(scope);
  return useApiMutation(
    async (ids: number[]) => {
      await batchDeleteAlbumImages(ids, scope);
      return ids.length;
    },
    {
      invalidate: [keys.root],
      successMessage: '已删除',
    },
  );
}
