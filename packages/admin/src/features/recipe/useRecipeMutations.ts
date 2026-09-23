import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { createRecipe, updateRecipe, deleteRecipe } from '../../api/recipe';
import { RECIPES_KEY } from './useRecipes';

/** 创建菜谱 */
export function useCreateRecipe() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  
  return useMutation({
    mutationFn: createRecipe,
    onSuccess: () => {
      message.success('创建成功');
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}

/** 更新菜谱 */
export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateRecipe(id, data),
    onSuccess: () => {
      message.success('更新成功');
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}

/** 删除菜谱 */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  
  return useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}
