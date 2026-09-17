import { Card, Typography } from 'antd';

interface CapabilityListProps {
  title: string;
  items: string[];
  /** secondary 用于"实现要点/坑"这类灰色文字；primary 是要做的功能清单 */
  tone?: 'primary' | 'secondary';
}

/**
 * 带标题的只读清单卡片。
 *
 * 原来 PlaceholderPage 里"计划实现的能力"和"实现要点"是两段几乎一样的 ul，
 * 只差一个文字颜色 —— 那就是组件的边界。
 */
export function CapabilityList({ title, items, tone = 'primary' }: CapabilityListProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Card title={title} size="small">
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2 }}>
        {items.map((item) => (
          <li key={item}>
            {tone === 'secondary' ? (
              <Typography.Text type="secondary">{item}</Typography.Text>
            ) : (
              <Typography.Text>{item}</Typography.Text>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
