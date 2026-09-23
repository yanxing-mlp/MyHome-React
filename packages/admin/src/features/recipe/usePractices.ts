import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  listPractices,
  createPracticeGroup,
  updatePracticeGroup as apiUpdatePracticeGroup,
  deletePracticeGroup,
  type PracticeOptionItem,
} from '../../api/recipe';

const PRACTICES_KEY = ['recipe', 'practices'] as const;

/** 查询全部做法分组（含组内选项和关联菜品数量） */
export function usePractices() {
  return useQuery({
    queryKey: PRACTICES_KEY,
    queryFn: listPractices,
  });
}

/** 创建做法分组（只建分组，选项到列表那一行的 + 里加） */
export function useCreatePracticeGroup() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: (name: string) => createPracticeGroup(name),
    onSuccess: () => {
      message.success('创建成功');
      queryClient.invalidateQueries({ queryKey: PRACTICES_KEY });
    },
    onError: (e: Error) => {
      message.error(e.message);
    },
  });
}

/**
 * 更新做法分组：组名和整组选项一次提交，后端按差量落。
 *
 * 页面上的三处改动（改组名、改某个选项的名字、加/删某个选项）都走这一个 hook，
 * 差别只在提交的选项列表。成功文案不区分动的是哪一处——本来就是同一个保存动作。
 * 失败时后端给的中文（组名重复、选项重名等）原样提示。
 */
export function useUpdatePracticeGroup() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, name, options }: { id: number; name: string; options: PracticeOptionItem[] }) =>
      apiUpdatePracticeGroup(id, name, options),
    onSuccess: () => {
      message.success('已保存');
      queryClient.invalidateQueries({ queryKey: PRACTICES_KEY });
    },
    onError: (e: Error) => {
      message.error(e.message);
    },
  });
}

/** 删除做法分组（级联删选项 + 解绑菜品） */
export function useDeletePracticeGroup() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: deletePracticeGroup,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: PRACTICES_KEY });
    },
    onError: (e: Error) => {
      message.error(e.message);
    },
  });
}
