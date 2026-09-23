import { useState } from 'react';
import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../../features/recipe/orderStatus';
import { practiceSummary } from '../../features/recipe/practiceSummary';
import { useChangeOrderStatus, useDeleteOrder } from '../../features/recipe/useOrderMutations';
import { useOrders } from '../../features/recipe/useOrders';
import { usePractices } from '../../features/recipe/usePractices';
import type { OrderStatus, RecipeOrderDTO } from '../../api/recipe';

const { Search } = Input;

/** 筛选条里的状态下拉：三档全给（不叫"全部"，清空即全部，与菜谱列表那几个下拉同一口径） */
const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
}));

/**
 * 当前状态能改去的那几档：只有待制作给按钮——已完成与已取消都是定稿档，
 * 后端也只留了 PENDING→COMPLETED、PENDING→CANCELLED 两个条件更新，那两行没有改档动作
 * （但可以给删除，见 {@link DELETABLE_STATUSES}）。
 * 字典里没有的状态同样一律不给按钮，免得点出一个后端不认的值。
 */
function statusActions(status: string): { to: OrderStatus; label: string; danger?: boolean }[] {
  if (status !== 'PENDING') {
    return [];
  }
  return [
    { to: 'COMPLETED', label: '标记已完成' },
    { to: 'CANCELLED', label: '取消订单', danger: true },
  ];
}

/**
 * 能删的那两档：都是定稿档，删除 = 整单连同明细物理删掉。
 *
 * 待制作不给删（那是要"取消"的，不是要"消失"的），后端按 `status != PENDING` 条件删兜底；
 * 这一页干脆连按钮都不渲染，非法选项不等到报错才露出来。
 */
const DELETABLE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

/**
 * 点单列表页：C 端每一单的快照，最近下单在前。
 *
 * 明细里的菜名与做法都是下单时落库的快照，所以菜品之后改名、下架，或做法字典被删，
 * 都不影响这一页已经点的内容——这正是后端把名字冗余存进 recipe_order_item 的目的。
 * 明细仍只在 C 端待制作期间动（「继续加菜」同菜累加），这一页只改状态：待制作可标记已完成、
 * 可取消，已完成与已取消都是定稿档、不给任何改档按钮（误点了也不会有撤回入口，只能再下一单）。
 * 那两档给一个**删除**（2026-09-21 加）：整单连同明细物理删掉，误建的历史单、试单都能清掉，
 * 份数与做法份数也跟着少这一单。待制作不给删——那是要取消的，不是要消失的。
 * 累计口径去「点单统计」看——已取消的单不算份数。
 *
 * 分页与筛选都在服务端（2026-09-21 改，原先是整表拉回前端切 20 行）：状态筛订单本身，
 * 关键词打在明细的菜名快照上，所以菜品之后改过名，老单按当时那个名字也搜得到。
 */
export function OrderListPage() {
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState<string>();
  const [status, setStatus] = useState<string>();

  const { data, isFetching } = useOrders({ keyword, status, pageNo, pageSize });
  const { data: practiceData } = usePractices();
  const changeStatus = useChangeOrderStatus();
  const deleteOrder = useDeleteOrder();
  const orders = data?.list ?? [];
  const practiceGroups = practiceData ?? [];

  const columns: ColumnsType<RecipeOrderDTO> = [
    {
      title: '订单号',
      dataIndex: 'id',
      width: 100,
      render: (id: number) => `#${id}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={ORDER_STATUS_COLOR[status] ?? 'default'}>
          {ORDER_STATUS_LABEL[status] ?? status}
        </Tag>
      ),
    },
    {
      title: '菜品明细',
      dataIndex: 'items',
      render: (_, order) => (
        <Space orientation="vertical" size={2} style={{ display: 'flex' }}>
          {order.items.map((item) => {
            const summary = practiceSummary(practiceGroups, item.practices);
            return (
              <span key={item.recipeId}>
                {item.recipeName}
                {summary && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    （{summary}）
                  </Typography.Text>
                )}
                <Typography.Text strong> ×{item.qty}</Typography.Text>
              </span>
            );
          })}
        </Space>
      ),
    },
    {
      title: '份数',
      dataIndex: 'totalQty',
      width: 90,
    },
    {
      title: '下单人',
      dataIndex: 'creatorId',
      width: 100,
      render: (id?: number | null) => <CreatorText id={id} />,
    },
    {
      title: '下单时间',
      dataIndex: 'createTime',
      width: 180,
      render: (time: string) => <TimeText value={time} />,
    },
    {
      title: '操作',
      width: 200,
      render: (_, order) => {
        const actions = statusActions(order.status);
        const deletable = DELETABLE_STATUSES.has(order.status);
        if (actions.length === 0 && !deletable) {
          return null;
        }
        return (
          <Space size={0}>
            {actions.map((action) => (
              <Button
                key={action.to}
                type="link"
                size="small"
                danger={action.danger}
                loading={
                  changeStatus.isPending && changeStatus.variables?.id === order.id
                }
                onClick={() => changeStatus.mutate({ id: order.id, status: action.to })}
              >
                {action.label}
              </Button>
            ))}
            {deletable && (
              <Popconfirm
                title="删除这一单？"
                description="整单连同明细一起删掉，点单统计与「点过 x 次」都跟着少这一单，无法恢复。"
                okText="删除"
                cancelText="取消"
                onConfirm={() => deleteOrder.mutate(order.id)}
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  loading={deleteOrder.isPending && deleteOrder.variables === order.id}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <PageShell title="点单列表">
      <Card variant="borderless">
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索菜名"
            allowClear
            onSearch={(value) => {
              setKeyword(value || undefined);
              setPageNo(1);
            }}
            style={{ width: 200 }}
          />
          <Select
            placeholder="状态"
            allowClear
            options={STATUS_OPTIONS}
            onChange={(value?: string) => {
              setStatus(value);
              setPageNo(1);
            }}
            style={{ width: 120 }}
          />
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={orders}
          loading={isFetching}
          pagination={{
            current: pageNo,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 单`,
            onChange: (page, size) => {
              setPageNo(page);
              setPageSize(size);
            },
          }}
          locale={{
            emptyText: keyword || status ? '没有符合条件的订单' : '还没有订单，去 C 端点一单吧',
          }}
        />
      </Card>
    </PageShell>
  );
}
