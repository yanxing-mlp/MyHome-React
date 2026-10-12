import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { App } from 'antd';
import {
  batchUpdateFileGroupSort,
  createFileGroup,
  deleteFileGroup,
  listFileGroups,
  setFileGroups,
  updateFileGroup,
} from '../../api/fileGroup';
import type { FileGroupBizType, FileGroupSortItem } from '../../api/fileGroup';
import { useValidationSession } from '../../hooks/useValidationSession';
import { withIdentity } from '../../lib/http';
import type { DataScope } from '../../lib/http';
import { FILE_KEY } from './useDocuments';
import { VIDEO_KEY } from '../video/useVideos';

/**
 * 文件/视频分组的查询与写操作（bizType + scope 参数化，文档组与视频组共用一份实现）。
 *
 * 缓存键带 bizType/scope/账号：文档组、视频组、公共、私人各自独立。写操作既刷分组列表
 * （组数、排序），也刷文档/视频列表（每行带 groupNames，改名/改归属后要跟着变）——
 * 所以统一失效 FILE_KEY 与 VIDEO_KEY 两个根。
 */
export function useFileGroupKeys(bizType: FileGroupBizType, scope: DataScope) {
  const user = useCurrentUser();
  return useMemo(() => {
    const root = ['file-group', bizType, scope, user?.id ?? null] as const;
    return { root, list: [...root, 'list'] as const };
  }, [bizType, scope, user?.id]);
}

function useInvalidateBoth() {
  const queryClient = useQueryClient();
  return useMemo(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: FILE_KEY });
      void queryClient.invalidateQueries({ queryKey: VIDEO_KEY });
    },
    [queryClient],
  );
}

/** 拖拽排序需要完整分组列表；不保留上一范围/账号/类型的占位数据。 */
export function useFileGroups(
  bizType: FileGroupBizType,
  scope: DataScope = 'PUBLIC',
  keyword?: string,
  enabled = true,
) {
  const user = useCurrentUser();
  const keys = useFileGroupKeys(bizType, scope);
  return useQuery({
    queryKey: [...keys.list, keyword ?? 'all'],
    queryFn: ({ signal }) =>
      listFileGroups(bizType, keyword, scope, {
        ...withIdentity(user ? String(user.id) : null),
        signal,
      }),
    enabled: enabled && !!user,
  });
}

/** 分组写操作共用：失败弹后端中文、成功刷文档+视频两侧缓存。返回值透传（新建返回分组 id）。 */
function useFileGroupMutation<TVariables, TResult = void>(
  bizType: FileGroupBizType,
  scope: DataScope,
  active: boolean,
  mutationFn: (vars: TVariables) => Promise<TResult>,
  successMessage: string,
) {
  const { message } = App.useApp();
  const invalidate = useInvalidateBoth();
  const { capture } = useValidationSession(active, `${bizType}:${scope}`);

  return useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: (vars: TVariables) => {
      if (!capture()()) throw new Error('页面已切换，请重新操作');
      return mutationFn(vars);
    },
    onSuccess: (_, __, session) => {
      invalidate();
      if (session?.isCurrent()) message.success(successMessage);
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error instanceof Error ? error.message : '操作失败，请重试');
    },
  });
}

export function useCreateFileGroup(bizType: FileGroupBizType, scope: DataScope = 'PUBLIC', active = true) {
  const user = useCurrentUser();
  return useFileGroupMutation(
    bizType,
    scope,
    active,
    (name: string) => createFileGroup(bizType, name, scope, withIdentity(user ? String(user.id) : null)),
    '已创建分组',
  );
}

export function useRenameFileGroup(bizType: FileGroupBizType, scope: DataScope = 'PUBLIC', active = true) {
  const user = useCurrentUser();
  return useFileGroupMutation(
    bizType,
    scope,
    active,
    ({ id, name }: { id: number; name: string }) =>
      updateFileGroup(id, bizType, name, scope, withIdentity(user ? String(user.id) : null)),
    '已重命名',
  );
}

export function useBatchUpdateFileGroupSort(bizType: FileGroupBizType, scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  return useFileGroupMutation(
    bizType,
    scope,
    true,
    (items: FileGroupSortItem[]) =>
      batchUpdateFileGroupSort(items, bizType, scope, withIdentity(user ? String(user.id) : null)),
    '排序已更新',
  );
}

/** 删除分组只解绑组内文件（外键级联），文件本身不删——所以文案不提"删除文件"。 */
export function useDeleteFileGroup(bizType: FileGroupBizType, scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  return useFileGroupMutation(
    bizType,
    scope,
    true,
    (id: number) => deleteFileGroup(id, bizType, scope, withIdentity(user ? String(user.id) : null)),
    '已删除分组',
  );
}

/** 整组覆盖某份文件的分组归属（编辑所属分组弹窗用）。 */
export function useSetFileGroups(bizType: FileGroupBizType, scope: DataScope = 'PUBLIC', active = true) {
  const user = useCurrentUser();
  return useFileGroupMutation(
    bizType,
    scope,
    active,
    ({ fileId, groupIds }: { fileId: number; groupIds: number[] }) =>
      setFileGroups(fileId, groupIds, bizType, scope, withIdentity(user ? String(user.id) : null)),
    '已保存',
  );
}
