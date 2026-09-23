import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { listAlbumGroups, listAlbumCities } from '../../api/album';
import type { AlbumGroupScope } from '../../api/album';

/** 所有相册查询共用 scope + 当前账号前缀，写操作可一次刷新分组、图片和城市。 */
export function useAlbumKeys(scope: AlbumGroupScope) {
  const user = useCurrentUser();
  return useMemo(() => {
    const root = ['album', scope, user?.id ?? null] as const;
    return {
      root,
      groups: [...root, 'groups'] as const,
      images: [...root, 'images'] as const,
      cities: [...root, 'cities'] as const,
    };
  }, [scope, user?.id]);
}

/** 拖拽排序需要完整分组列表；不保留上一范围或账号的占位数据。 */
export function useAlbumGroups(keyword: string | undefined, scope: AlbumGroupScope, enabled = true) {
  const keys = useAlbumKeys(scope);
  return useQuery({
    queryKey: [...keys.groups, keyword],
    queryFn: ({ signal }) => listAlbumGroups(keyword, scope, signal),
    enabled: enabled && keys.root[2] != null,
  });
}

export function useAlbumCities(scope: AlbumGroupScope, enabled = true) {
  const keys = useAlbumKeys(scope);
  return useQuery({
    queryKey: keys.cities,
    queryFn: ({ signal }) => listAlbumCities(scope, signal),
    enabled: enabled && keys.root[2] != null,
  });
}
