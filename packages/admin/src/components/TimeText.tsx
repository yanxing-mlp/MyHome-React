import { Typography } from 'antd';
import { formatDateTime } from '@family-home/shared/format';

interface TimeTextProps {
  /** 后端返回的 ISO 时间串（LocalDateTime，不带时区偏移） */
  value?: string | null;
  /**
   * 时间前面的灰字标签，如「添加」「修改」。
   *
   * 表格列有表头，不需要标签；窄屏卡片没有表头，必须带，否则两行时间分不清谁是谁。
   * 这是两种形态共用一个组件的唯一差异，所以只有这一个可选 prop。
   */
  label?: string;
}

/**
 * 次要色的时间文本（12px）。
 *
 * 抽出来的理由：每个列表页都有「添加时间 / 修改时间」两列，窄屏卡片上还要再排一次，
 * 三处的格式化与样式必须一模一样（同一个 formatDateTime、同为次要色、同一字号）。
 * 口径定义在这一处，M3/M4 的页面直接复用。
 *
 * 没有值就整行不渲染，不放 '-' 占位符。
 */
export function TimeText({ value, label }: TimeTextProps) {
  if (!value) return null;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {label ? `${label} ${formatDateTime(value)}` : formatDateTime(value)}
    </Typography.Text>
  );
}
