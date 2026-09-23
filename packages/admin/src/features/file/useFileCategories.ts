import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@family-home/shared/auth';
import { App } from 'antd';
import { createFileCategory, listFileCategories } from '../../api/file';
import { useValidationSession } from '../../hooks/useValidationSession';
import { withIdentity } from '../../lib/http';
import type { DataScope } from '../../lib/http';
import { FILE_KEY } from './useDocuments';

export const FILE_CATEGORIES_KEY = [...FILE_KEY, 'categories'] as const;

/** 分类与文档一样按分区和账号隔离，PRIVATE 不共享分类。 */
export function useFileCategories(scope: DataScope = 'PUBLIC') {
  const user = useCurrentUser();
  return useQuery({
    queryKey: [...FILE_CATEGORIES_KEY, scope, user?.id ?? null],
    queryFn: ({ signal }) => listFileCategories(scope, {
      ...withIdentity(user ? String(user.id) : null), signal,
    }),
    enabled: !!user,
  });
}

/** 创建失败保留服务端中文；旧会话只刷新缓存，不提示或选择新分类。 */
export function useCreateFileCategory(scope: DataScope = 'PUBLIC', active = true) {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { capture } = useValidationSession(active, scope);

  return useMutation({
    onMutate: () => ({ isCurrent: capture() }),
    mutationFn: (name: string) => {
      if (!capture()()) throw new Error('页面已切换，请重新操作');
      return createFileCategory(name, scope, withIdentity(user ? String(user.id) : null));
    },
    onSuccess: (_, __, session) => {
      void queryClient.invalidateQueries({ queryKey: FILE_KEY });
      if (session?.isCurrent()) message.success('创建成功');
    },
    onError: (error, _, session) => {
      if (session?.isCurrent()) message.error(error.message || '创建分类失败');
    },
  });
}
