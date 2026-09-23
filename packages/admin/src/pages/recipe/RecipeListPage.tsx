import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card, Input, Select, Space, Switch, Table, Tag, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { resolveRecipeCover } from '@family-home/shared/image';

import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { TimeText } from '../../components/TimeText';
import { useRecipes } from '../../features/recipe/useRecipes';
import { useUpdateRecipe, useDeleteRecipe } from '../../features/recipe/useRecipeMutations';
import { useCategories } from '../../features/recipe/useCategories';
import type { RecipeDTO } from '../../api/recipe';

const { Search } = Input;

export function RecipeListPage() {
  const navigate = useNavigate();
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState<string>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>();
  const [status, setStatus] = useState<string>();

  const { data, isFetching } = useRecipes({
    keyword,
    status,
    categoryId: selectedCategoryId,
    pageNo,
    pageSize,
  });

  const { data: categories } = useCategories();

  const updateMutation = useUpdateRecipe();
  const deleteMutation = useDeleteRecipe();

  const handleToggleStatus = async (record: RecipeDTO) => {
    const newStatus = record.status === 'ON_SHELF' ? 'OFF_SHELF' : 'ON_SHELF';
    await updateMutation.mutateAsync({
      id: record.id,
      data: { name: record.name, status: newStatus },
    });
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync(id);
  };

  const columns: ColumnsType<RecipeDTO> = [
    {
      title: '封面',
      dataIndex: 'coverUrl',
      width: 100,
      // 没配图给默认封面，不给 '-'：这一列是「这道菜长什么样」，空着会让人以为图没了而不是没传过
      render: (url?: string) => (
        <img
          src={resolveRecipeCover(url)}
          alt=""
          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: '菜名',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '菜品分类',
      dataIndex: 'category',
      width: 150,
      render: (category?: string) =>
        category ? <Tag color="blue">{category}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      // 开关直接当状态列：以前是"绿 Tag + 操作栏里一个小开关"两处各说一遍，
      // 现在只留开关。不给 size="small"：小尺寸只有 16px 高，塞"上架/下架"四个字会被挤扁，
      // 就是"样式不好看"的根因；默认尺寸 22px 才放得下这两个字。
      // 也没挂 loading：全页共用一个 updateMutation，一 loading 所有行的开关一起转。
      render: (s: string, record) => (
        <Switch
          checked={s === 'ON_SHELF'}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="上架"
          unCheckedChildren="下架"
        />
      ),
    },
    {
      title: '添加人',
      dataIndex: 'creatorId',
      width: 100,
      render: (id?: number | null) => <CreatorText id={id} />,
    },
    {
      title: '修改时间',
      dataIndex: 'updateTime',
      width: 180,
      render: (t: string) => <TimeText value={t} />,
    },
    {
      title: '操作',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/recipe/${record.id}/edit`)}>
            编辑
          </Button>
          <Popconfirm
            title="删除菜谱"
            description={`确定要删除「${record.name}」吗？该操作不可恢复。`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageShell title="菜谱列表">
      <Card
        variant="borderless"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/recipe/new')}>
            新建菜谱
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索菜名"
            allowClear
            onSearch={setKeyword}
            style={{ width: 200 }}
          />
          <Select
            placeholder="筛选分类"
            allowClear
            options={categories?.map((c: { id: number; name: string }) => ({ label: c.name, value: c.id }))}
            onChange={setSelectedCategoryId}
            style={{ width: 200 }}
          />
          <Select
            placeholder="状态"
            allowClear
            options={[
              { label: '上架', value: 'ON_SHELF' },
              { label: '下架', value: 'OFF_SHELF' },
            ]}
            onChange={setStatus}
            style={{ width: 120 }}
          />
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.list}
          loading={isFetching}
          pagination={{
            current: pageNo,
            pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
              setPageNo(page);
              setPageSize(size);
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </PageShell>
  );
}
