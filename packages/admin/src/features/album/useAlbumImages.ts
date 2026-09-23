import { useQuery } from '@tanstack/react-query';
import { pageAlbumImages } from '../../api/album';
import type { AlbumImageQuery } from '../../api/album';
import { useAlbumKeys } from './useAlbumGroups';

/** 相册图片分页查询；scope 与账号隔离，不用跨查询的旧数据占位。 */
export function useAlbumImages(query: AlbumImageQuery, enabled = true) {
  const keys = useAlbumKeys(query.scope);
  return useQuery({
    queryKey: [...keys.images, query],
    queryFn: ({ signal }) => pageAlbumImages(query, signal),
    enabled: enabled && keys.root[2] != null,
  });
}
