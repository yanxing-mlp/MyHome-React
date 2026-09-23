import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import {
  listCategories,
  createCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory,
} from '../../api/recipe';

const CATEGORIES_KEY = ['recipe', 'categories'] as const;

/** 查询所有分类 */
export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: listCategories,
  });
}

/** 创建分类 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ name, sortOrder }: { name: string; sortOrder?: number }) => createCategory(name, sortOrder),
    onSuccess: () => {
      message.success('创建成功');
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

/** 更新分类 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, name, sortOrder }: { id: number; name: string; sortOrder?: number }) =>
      apiUpdateCategory(id, name, sortOrder),
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

/** 删除分类 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}
