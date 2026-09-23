import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router';
import { PageShell } from '../components/PageShell';
import { TimeText } from '../components/TimeText';
import type { RecipeOrderDTO, RecipeOrderStatDTO } from '../api/recipe';
import { useAlbumGroups } from '../features/album/useAlbumGroups';
import { useAlbumImages } from '../features/album/useAlbumImages';
import { useDocuments } from '../features/file/useDocuments';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../features/recipe/orderStatus';
import { useOrderStatistics } from '../features/recipe/useOrderStatistics';
import { useOrders } from '../features/recipe/useOrders';
import { useRecipes } from '../features/recipe/useRecipes';
import { useVaultAccounts } from '../features/vault/useVaultAccounts';

/** 一张总览卡片：数字 + 一行分解小字，整张可点进对应模块 */
interface StatCard {
  /** 点卡片要去的路由，同时当 key 用 */
  key: string;
  title: string;
  value: number;
  /** 数字下面那行小字（分组数 / 上架数…），没有就不渲染 */
  hint?: string;
  loading: boolean;
  /** 只有"有事要做"的那张用：非零时数字着橙色 */
  attention?: boolean;
}

/** 两张预览表各取前 5 条：首页只负责"看一眼 + 点进去"，完整列表在各自的页面 */
const PREVIEW_ROWS = 5;

const RECENT_ORDER_COLUMNS: ColumnsType<RecipeOrderDTO> = [
  {
    title: '状态',
    dataIndex: 'status',
    width: 92,
    render: (status: string) => (
      <Tag color={ORDER_STATUS_COLOR[status] ?? 'default'}>{ORDER_STATUS_LABEL[status] ?? status}</Tag>
    ),
  },
  {
    title: '菜品',
    dataIndex: 'items',
    render: (_, order) => {
      const first = order.items[0];
      if (!first) {
        return null;
      }
      return order.items.length > 1 ? `${first.recipeName} 等 ${order.items.length} 项` : first.recipeName;
    },
  },
  { title: '份数', dataIndex: 'totalQty', width: 64 },
  {
    title: '时间',
    dataIndex: 'createTime',
    width: 130,
    render: (time: string) => <TimeText value={time} />,
  },
];

const HOT_RECIPE_COLUMNS: ColumnsType<RecipeOrderStatDTO> = [
  { title: '菜品', dataIndex: 'recipeName' },
  {
    title: '累计份数',
    dataIndex: 'totalQty',
    width: 100,
    render: (qty: number) => <Typography.Text strong>{qty}</Typography.Text>,
  },
];

/**
 * B 端首页：一进来先看见"家里有多少东西、有什么等着做"，再点进对应模块。
 *
 * 口径全部跟着各模块自己的列表页走（同一个接口、同一份查询），所以这里的数字
 * 和点进去看到的条数一定对得上，不额外发明"首页专用"的统计：
 * - 家庭图片数 = 家庭相册图片管理页的总数（一张图挂多个分组也只算一张，不含个人域）；
 * - 菜品 = 菜谱列表页的总数，副行是其中上架的；
 * - 待制作 = 点单列表里状态为待制作的单数，是首页唯一"有事要做"的数，非零时着橙色；
 * - 累计份数 = 点单统计页的合计，已取消的单不算。
 *
 * 所有数据都来自现成的 B 端读接口，没有为首页新增后端接口。
 */
export function HomePage() {
  const navigate = useNavigate();

  const { data: groups, isPending: groupsPending } = useAlbumGroups(undefined, 'FAMILY');
  const { data: imagePage, isPending: imagesPending } = useAlbumImages({ scope: 'FAMILY', pageNo: 1, pageSize: 1 });
  const { data: recipePage, isPending: recipesPending } = useRecipes({ pageNo: 1, pageSize: 1 });
  const { data: onShelfPage, isPending: onShelfPending } = useRecipes({
    pageNo: 1,
    pageSize: 1,
    status: 'ON_SHELF',
  });
  // 点单列表分页之后，首页这两个数都改吃服务端 total（与菜品那张 `pageSize:1` 拿总数同一口径）：
  // 待制作数就是 status=PENDING 那一页的 total，不会再被"只拉了一页"截断
  const { data: orderPage, isPending: ordersPending } = useOrders({
    pageNo: 1,
    pageSize: PREVIEW_ROWS,
  });
  const { data: pendingPage, isPending: pendingPending } = useOrders({
    pageNo: 1,
    pageSize: 1,
    status: 'PENDING',
  });
  // 统计页分页了，首页要的却是"全部菜品的份数之和"与"前 5 名"，所以这里一次拉满一页（pageSize=100 是接口上限）：
  // 后端排的就是份数倒序，前 PREVIEW_ROWS 条即热门榜；家庭量级被点过的菜品远不到 100 道。
  const { data: statPage, isPending: statsPending } = useOrderStatistics({
    pageNo: 1,
    pageSize: 100,
  });
  const { data: documents, isPending: documentsPending } = useDocuments(undefined, 'PUBLIC');
  const { data: vaultPage, isPending: vaultPending } = useVaultAccounts({ scope: 'PUBLIC', pageNo: 1, pageSize: 1 });

  const orderList = orderPage?.list ?? [];
  const statList = statPage?.list ?? [];
  const pendingOrders = pendingPage?.total ?? 0;
  const totalQty = statList.reduce((sum, item) => sum + item.totalQty, 0);

  const cards: StatCard[] = [
    {
      key: '/album/images',
      title: '家庭图片',
      value: imagePage?.total ?? 0,
      hint: `家庭相册 · ${groups?.length ?? 0} 个分组`,
      loading: imagesPending || groupsPending,
    },
    {
      key: '/recipe',
      title: '菜品',
      value: recipePage?.total ?? 0,
      hint: `上架 ${onShelfPage?.total ?? 0}`,
      loading: recipesPending || onShelfPending,
    },
    {
      key: '/recipe/orders',
      title: '待制作',
      value: pendingOrders,
      hint: `共 ${orderPage?.total ?? 0} 单`,
      loading: ordersPending || pendingPending,
      attention: pendingOrders > 0,
    },
    {
      key: '/recipe/statistics',
      title: '累计份数',
      value: totalQty,
      hint: `${statList.length} 个菜品被点过`,
      loading: statsPending,
    },
    {
      key: '/file/public',
      title: '公共文件',
      value: documents?.length ?? 0,
      loading: documentsPending,
    },
    {
      key: '/vault/public',
      title: '公共密码',
      value: vaultPage?.total ?? 0,
      loading: vaultPending,
    },
  ];

  return (
    <PageShell title="首页">
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col key={card.key} xs={24} sm={12} lg={8} xxl={4}>
            <Card
              hoverable
              loading={card.loading}
              variant="borderless"
              style={{ height: '100%' }}
              onClick={() => navigate(card.key)}
            >
              <Statistic
                title={card.title}
                value={card.value}
                styles={card.attention ? { content: { color: '#fa8c16' } } : undefined}
              />
              {card.hint ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {card.hint}
                </Typography.Text>
              ) : null}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近点单" variant="borderless" style={{ height: '100%' }}>
            <Table
              rowKey="id"
              size="small"
              columns={RECENT_ORDER_COLUMNS}
              dataSource={orderList}
              loading={ordersPending}
              pagination={false}
              locale={{ emptyText: '还没有订单，去 C 端点一单吧' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="热门菜品" variant="borderless" style={{ height: '100%' }}>
            <Table
              rowKey="recipeId"
              size="small"
              columns={HOT_RECIPE_COLUMNS}
              dataSource={statList.slice(0, PREVIEW_ROWS)}
              loading={statsPending}
              pagination={false}
              locale={{ emptyText: '还没有订单，去 C 端点一单吧' }}
            />
          </Card>
        </Col>
      </Row>
    </PageShell>
  );
}
