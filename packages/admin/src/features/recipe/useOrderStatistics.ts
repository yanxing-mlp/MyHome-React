import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pageOrderStatistics } from '../../api/recipe';
import type { RecipeOrderStatQueryRequest } from '../../api/recipe';

/**
 * 导出给删除订单那个 mutation 用：删掉一整单，累计份数跟着变，统计页得重新拉。
 * 这里只是**前缀**——真正的 queryKey 是 `[...ORDER_STAT_KEY, query]`，
 * 所以 `invalidateQueries({ queryKey: ORDER_STAT_KEY })` 照样能一把刷新所有页和筛选组合。
 */
export const ORDER_STAT_KEY = ['recipe', 'order-stat'] as const;

/** 点单统计：每个菜品的累计下单份数（分页 + 菜名筛选都在服务端） */
export function useOrderStatistics(query: RecipeOrderStatQueryRequest) {
  return useQuery({
    queryKey: [...ORDER_STAT_KEY, query],
    queryFn: () => pageOrderStatistics(query),
    placeholderData: keepPreviousData,
  });
}
