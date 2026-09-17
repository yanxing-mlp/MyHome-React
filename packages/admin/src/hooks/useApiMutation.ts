import { App } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { ApiError } from '@family-home/shared/http';

interface UseApiMutationOptions<TData> {
  /** 成功后要失效的查询 key（列表刷新靠它，不手写 refetch） */
  invalidate?: QueryKey[];
  /** 成功提示，如 '已保存' */
  successMessage?: string;
  onSettledSuccess?: (data: TData) => void;
}

/**
 * 写操作统一封装。
 *
 * 每个新增/编辑/删除都要同一套四件事：按钮 loading、失败弹后端那句中文、
 * 成功后失效相关查询、成功提示。散落写会有两个后果：文案不一致、
 * 以及漏掉 invalidate 之后"删了但列表还在"。
 *
 * 后端 message 已经是可直接展示的中文（方案 §5.2），所以失败时**不再**按错误码分支，
 * 直接展示 —— 需要按 code 特判的场景（如 409 重名）由调用方在 onSettledError 里加。
 */
export function useApiMutation<TVariables, TData = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseApiMutationOptions<TData> = {},
) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { invalidate, successMessage, onSettledSuccess } = options;

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: (data) => {
      invalidate?.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
      if (successMessage) {
        message.success(successMessage);
      }
      onSettledSuccess?.(data);
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : '操作失败，请重试');
    },
  });
}
