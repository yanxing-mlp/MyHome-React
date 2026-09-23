import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pageRecipes, getRecipeDetail } from '../../api/recipe';
import type { RecipeQueryRequest } from '../../api/recipe';

export const RECIPES_KEY = ['recipes'] as const;

/** 菜谱分页查询 */
export function useRecipes(query: RecipeQueryRequest) {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'page', query],
    queryFn: () => pageRecipes(query),
    placeholderData: keepPreviousData,
  });
}

/** 菜谱详情 */
export function useRecipeDetail(id?: number) {
  return useQuery({
    queryKey: [...RECIPES_KEY, 'detail', id],
    queryFn: () => (id ? getRecipeDetail(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}
