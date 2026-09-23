/**
 * 订单状态的展示字典：文案 + Tag 颜色。
 *
 * 抽出来的理由和 practiceSummary 一样——点单列表和首页的「最近点单」都要把后端返回的
 * 状态码翻译成人话，两处措辞与颜色必须一模一样。
 * 字典里没有的状态原样显示状态码，便于发现前后端不一致。
 */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: '待制作',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: 'orange',
  COMPLETED: 'green',
  CANCELLED: 'default',
};
