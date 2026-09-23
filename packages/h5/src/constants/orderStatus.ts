/**
 * 订单状态展示文案。
 *
 * 状态有三档：待制作可以推成已完成、也可以取消（两个操作 C/B 端都给）；已完成与已取消都是定稿档，
 * 两端都没有改回待制作的入口。没有"制作中"。
 * 字典里没有时原样显示状态码，便于发现前后端不一致，而不是悄悄显示成空。
 */
const LABEL_BY_STATUS: Record<string, string> = {
  PENDING: '待制作',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

/** 待制作：只有这个状态的订单给"继续加菜""已完成""取消订单"三个按钮 */
export const ORDER_STATUS_PENDING = 'PENDING';

/** 已完成与已取消都算这一单做完了/不做了，C 端只剩"再来一单" */
export const ORDER_STATUS_COMPLETED = 'COMPLETED';

/** 已取消：终态，明细留着但不再算进"点过 x 次"，两端都不给改回 */
export const ORDER_STATUS_CANCELLED = 'CANCELLED';

export function orderStatusLabel(status: string): string {
  return LABEL_BY_STATUS[status] ?? status;
}
