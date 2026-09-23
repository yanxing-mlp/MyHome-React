import type { ReactNode } from 'react';
import { Card, Empty, Pagination, Space, Table } from 'antd';
import type { TableProps } from 'antd';
import { useIsMobile } from '@family-home/shared/hooks';

interface ResponsiveListProps<T> {
  items: T[];
  /** 稳定 key。窄屏卡片列表也用它，所以必须是函数而不是字段名 */
  keyOf: (item: T) => string | number;
  /** 宽屏列定义 */
  columns: NonNullable<TableProps<T>['columns']>;
  /** 窄屏（<768px）单条怎么渲染 */
  renderCard: (item: T, index: number) => ReactNode;
  loading?: boolean;
  /** 传了就在两种形态下都渲染同一个分页器 */
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  emptyText?: ReactNode;
}

/**
 * 宽屏 Table / 窄屏卡片列表。
 *
 * 这是方案 §7.2 里点名"响应式唯一的真正额外成本"那一处：手机上横向滚动的表格基本没法用，
 * 所以菜谱列表、相册分组、密码本都得做两套渲染。两套的逻辑（loading、空态、分页）
 * 是完全一样的，只有单条渲染不同 —— 于是把"按断点换形态"收进这一个组件，
 * 页面只交两份 columns / renderCard。
 *
 * 断点用 shared 的 useIsMobile（matchMedia，<768px），不依赖 antd 的 Grid API（方案 §7.2 第 1 点）。
 */
export function ResponsiveList<T>({
  items,
  keyOf,
  columns,
  renderCard,
  loading,
  pagination,
  emptyText,
}: ResponsiveListProps<T>) {
  const isMobile = useIsMobile();

  const paginationNode = pagination ? (
    <Pagination
      style={{ display: 'flex', justifyContent: 'flex-end' }}
      current={pagination.current}
      pageSize={pagination.pageSize}
      total={pagination.total}
      showSizeChanger={false}
      onChange={pagination.onChange}
    />
  ) : null;

  if (!isMobile) {
    return (
      <Table<T>
        rowKey={keyOf}
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={pagination ?? false}
        scroll={{ x: 'max-content' }}
        locale={emptyText ? { emptyText } : undefined}
      />
    );
  }

  if (!loading && items.length === 0) {
    return <Empty description={emptyText ?? '暂无数据'} />;
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {items.map((item, index) => (
        <Card key={keyOf(item)} size="small">
          {renderCard(item, index)}
        </Card>
      ))}
      {paginationNode}
    </Space>
  );
}
