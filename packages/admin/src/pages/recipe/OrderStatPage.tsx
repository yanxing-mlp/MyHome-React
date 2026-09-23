import { useState } from 'react';
import { Card, Input, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { resolveRecipeCover } from '@family-home/shared/image';
import { PageShell } from '../../components/PageShell';
import { practiceCountSummary } from '../../features/recipe/practiceSummary';
import { useOrderStatistics } from '../../features/recipe/useOrderStatistics';
import { usePractices } from '../../features/recipe/usePractices';
import type { RecipeOrderStatDTO } from '../../api/recipe';

const { Search } = Input;

/**
 * 点单统计页：每个菜品被下单的累计份数，外加这道菜各做法选项分别被点了多少份。
 *
 * 数据来自 recipe_order_item 按菜品聚合（SUM(qty)），所以统计口径是"份数"
 * 而不是"订单数"——同一单里加 3 份就算 3；已取消的单整笔不算。
 * 后端两档都已按份数倒序返回，页面只把做法的选项 ID 换成字典里的名字，
 * 字典里已删除的选项不显示（快照不记名字），没点过做法的菜这一列留白。
 *
 * 分页与筛选都在服务端（2026-09-21 改，原先一次列全部菜品）：分页翻的是"哪几道菜的行"，
 * 每行那份数仍是这道菜的**全历史**累计（服务端先聚合全量再切片），所以翻页不会看到数字变小。
 * 也因此工具栏那句"合计 M 份"删了——手里的只是一页，那个和看着像全局其实是本页的。
 */
export function OrderStatPage() {
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState<string | undefined>();
  const { data, isFetching } = useOrderStatistics({ keyword, pageNo, pageSize });
  const { data: practiceData } = usePractices();
  const stats = data?.list ?? [];
  const practiceGroups = practiceData ?? [];

  const columns: ColumnsType<RecipeOrderStatDTO> = [
    {
      title: '封面',
      dataIndex: 'coverUrl',
      width: 100,
      // 菜品的当前封面，不是各笔订单的快照（一行并了多笔订单，快照可能各不相同）。
      // 与菜品列表同一口径：没配图给默认封面，不留空
      render: (url?: string | null) => (
        <img
          src={resolveRecipeCover(url)}
          alt=""
          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: '菜品',
      dataIndex: 'recipeName',
      width: 200,
    },
    {
      title: '做法',
      dataIndex: 'practices',
      render: (_, stat) => practiceCountSummary(practiceGroups, stat.practices),
    },
    {
      title: '累计下单份数',
      dataIndex: 'totalQty',
      width: 160,
      render: (qty: number) => <Typography.Text strong>{qty}</Typography.Text>,
    },
  ];

  return (
    <PageShell title="点单统计">
      <Card variant="borderless">
        <Search
          placeholder="搜索菜名"
          allowClear
          onSearch={(value) => {
            setKeyword(value || undefined);
            setPageNo(1);
          }}
          style={{ width: 200, marginBottom: 16 }}
        />

        <Table
          rowKey="recipeId"
          columns={columns}
          dataSource={stats}
          loading={isFetching}
          pagination={{
            current: pageNo,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `${total} 个菜品被点过`,
            onChange: (page, size) => {
              setPageNo(page);
              setPageSize(size);
            },
          }}
          locale={{
            emptyText: keyword ? '没有符合条件的菜品' : '还没有订单，去 C 端点一单吧',
          }}
        />
      </Card>
    </PageShell>
  );
}
