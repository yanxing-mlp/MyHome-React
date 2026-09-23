import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { pageOrders } from '../../api/recipe';
import type { RecipeOrderQueryRequest } from '../../api/recipe';

/**
 * 点单列表查询 key 的前缀。
 *
 * 具体每次查询是 `[...ORDERS_KEY, query]`，所以写操作只要 invalidate 这个前缀
 * （react-query 默认按前缀匹配）就能把列在各页/各筛选条件下的列表一起刷掉。
 */
export const ORDERS_KEY = ['recipe', 'orders'] as const;

/** 点单列表：分页 + 条件过滤（整单快照，后端把明细一起返回），最近下单的在前 */
export function useOrders(query: RecipeOrderQueryRequest) {
  return useQuery({
    queryKey: [...ORDERS_KEY, query],
    queryFn: () => pageOrders(query),
    // 翻页/换筛选时上一页的内容先留着，免得表格闪一下白
    placeholderData: keepPreviousData,
  });
}
