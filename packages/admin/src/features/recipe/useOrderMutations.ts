import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { cancelOrder, completeOrder, deleteOrder, type OrderStatus } from '../../api/recipe';
import { ORDERS_KEY } from './useOrders';
import { ORDER_STAT_KEY } from './useOrderStatistics';

/** 两个改档动作的回执文案（与 C 端按钮同一句，避免两端各说各话） */
const SUCCESS_TEXT: Record<OrderStatus, string> = {
  COMPLETED: '已标记完成',
  CANCELLED: '已取消这一单',
};

/**
 * 改订单状态：一个 mutation 管两档，按目标状态分派到后端那两个无请求体的 POST。
 *
 * 只改状态，明细与份数一律不动，所以成功之后不需要重算快照，只要让列表重新拉一遍。
 */
export function useChangeOrderStatus() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      status === 'CANCELLED' ? cancelOrder(id) : completeOrder(id),
    onSuccess: (_data, { status }) => {
      message.success(SUCCESS_TEXT[status]);
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    // 后端挡下来时（比如已完成的单被点取消）原样提示中文文案，别只留一个"请求失败"
    onError: (e: Error) => message.error(e.message),
  });
}

/**
 * 删除订单：只有已完成/已取消两档给这个按钮（列表页那行按状态决定渲不渲染），
 * 后端按 `status != PENDING` 条件删，所以两边都挡得住。
 *
 * 整单连同明细物理删掉，累计份数跟着少这一单，所以除了列表还得让统计页重新拉一遍。
 * 没有撤回入口，所以按钮是 danger + 二次确认。
 */
export function useDeleteOrder() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: (id: number) => deleteOrder(id),
    onSuccess: () => {
      message.success('已删除这一单');
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: ORDER_STAT_KEY });
    },
    onError: (e: Error) => message.error(e.message),
  });
}
