import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Input, Popconfirm, Table, Typography } from 'antd';
import { FormModal } from '../../components/FormModal';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { DuplicateNameInput } from '../../components/DuplicateNameInput';
import { useValidationSession } from '../../hooks/useValidationSession';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, MenuOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { PageShell } from '../../components/PageShell';
import { CreatorText } from '../../components/CreatorText';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../features/recipe/useCategories';
import type { RecipeCategoryDTO } from '../../api/recipe';

type RowDragValue = Pick<ReturnType<typeof useSortable>, 'attributes' | 'setActivatorNodeRef' | 'listeners'>;

/**
 * 拖拽的激活权交给把手图标，不铺在整行上：
 * `<tr {...listeners}>` 会让 dnd-kit 在 pointerdown 就把事件吃掉，行里任何点击（改名、删除）都点不动。
 */
const RowDragContext = createContext<RowDragValue>({} as RowDragValue);

/** 把手单元格的内容：从所属行的 context 里拿激活用的 ref 与监听 */
function DragHandle() {
  const { attributes, setActivatorNodeRef, listeners } = useContext(RowDragContext);
  return (
    <span ref={setActivatorNodeRef} {...attributes} {...listeners} style={{ cursor: 'grab', color: '#999' }}>
      <MenuOutlined />
    </span>
  );
}

/** 可拖拽的行：只提供落点与位移，自身不挂监听 */
function SortableRow({
  children,
  ...restProps
}: React.HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) {
  const { attributes, setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: restProps['data-row-key'],
  });

  const contextValue = useMemo(() => ({ attributes, setActivatorNodeRef, listeners }), [
    attributes,
    setActivatorNodeRef,
    listeners,
  ]);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr {...restProps} ref={setNodeRef} style={style}>
      {/* Provider 不产生 DOM 节点，tr 的直接子元素仍然是各个 td */}
      <RowDragContext.Provider value={contextValue}>{children}</RowDragContext.Provider>
    </tr>
  );
}

/**
 * 菜品分类管理页：一行一个分类，展示名称、排序权重、关联菜品数。
 *
 * 分类名称**在表格里直接改**：点名称变输入框，回车或失焦保存，没有「编辑」按钮这一步。
 * 空名、重名不提交；名称统一由服务端全域预检，失败时保留草稿。
 * 顺序靠把手图标拖，拖完按 1..n 重排权重；新建走弹窗，默认排在最后。
 */
export function CategoryManagePage() {
  const { message } = App.useApp();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { capture } = useValidationSession(isAddModalOpen);
  const [sortedCategories, setSortedCategories] = useState<RecipeCategoryDTO[]>([]);

  const { data: categories, isFetching } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  // 同步后端数据到本地状态
  useEffect(() => {
    if (categories) {
      setSortedCategories([...categories]);
    }
  }, [categories]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedCategories.findIndex((c) => c.id.toString() === active.id);
    const newIndex = sortedCategories.findIndex((c) => c.id.toString() === over.id);

    const newCategories = arrayMove(sortedCategories, oldIndex, newIndex);
    setSortedCategories(newCategories);

    // 批量更新排序权重（从1开始递增）
    newCategories.forEach((category, index) => {
      const newSortOrder = index + 1;
      if (category.sortOrder !== newSortOrder) {
        updateMutation.mutate({ id: category.id, name: category.name, sortOrder: newSortOrder });
      }
    });
  };

  const handleAddConfirm = async (values: { name: string }) => {
    const isCurrent = capture();
    try {
      await createMutation.mutateAsync({ name: values.name.trim(), sortOrder: sortedCategories.length + 1 });
      if (isCurrent()) setIsAddModalOpen(false);
    } catch (error) {
      if (isCurrent()) message.error(error instanceof Error ? error.message : '创建分类失败');
    }
  };

  const handleEdit = (category: RecipeCategoryDTO) => {
    // 当前输入校验未通过时，点其他行也不能丢掉草稿；Escape 可取消。
    if (editingId === null) setEditingId(category.id);
  };

  const handleSave = async (category: RecipeCategoryDTO, name: string) => {
    if (name !== category.name) {
      await updateMutation.mutateAsync({ id: category.id, name, sortOrder: category.sortOrder });
    }
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync(id);
  };

  const columns: ColumnsType<RecipeCategoryDTO> = [
    {
      title: '分类名称',
      dataIndex: 'name',
      render: (name: string, record) =>
        editingId === record.id ? (
          <DuplicateNameInput
            key={record.id}
            initialValue={record.name}
            duplicate={{ kind: 'RECIPE_CATEGORY', excludeId: record.id }}
            requiredMessage="请输入分类名称"
            onSave={(name) => handleSave(record, name)}
            onSaved={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
            autoFocus
            style={{ width: 200 }}
          />
        ) : (
          <Typography.Text onClick={() => handleEdit(record)} style={{ cursor: 'text' }}>
            {name}
          </Typography.Text>
        ),
    },
    {
      title: '排序权重',
      dataIndex: 'sortOrder',
      width: 120,
    },
    {
      title: '关联菜品',
      dataIndex: 'recipeCount',
      width: 120,
      render: (count: number) => count ?? 0,
    },
    {
      title: '添加人',
      dataIndex: 'creatorId',
      width: 120,
      render: (id?: number | null) => <CreatorText id={id} />,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确定删除此分类吗？"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageShell title="菜品分类">
      <Card
        variant="borderless"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)}>
            新建分类
          </Button>
        }
      >
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedCategories.map((c) => c.id.toString())} strategy={verticalListSortingStrategy}>
            <Table
              rowKey="id"
              columns={[
                {
                  title: '',
                  width: 40,
                  render: () => <DragHandle />,
                },
                ...columns,
              ]}
              dataSource={sortedCategories}
              loading={isFetching}
              pagination={false}
              components={{
                body: {
                  row: SortableRow,
                },
              }}
            />
          </SortableContext>
        </DndContext>
      </Card>

      {/* 新建分类弹窗 */}
      <FormModal<{ name: string }>
        title="新建分类"
        open={isAddModalOpen}
        onSubmit={handleAddConfirm}
        onClose={() => setIsAddModalOpen(false)}
        confirmLoading={createMutation.isPending}
        okText="确定"
      >
        <DuplicateFormItem
          label="分类名称"
          name="name"
          active={isAddModalOpen}
          duplicate={{ kind: 'RECIPE_CATEGORY' }}
          rules={[{ required: true, whitespace: true, message: '请输入分类名称' }]}
        >
          <Input placeholder="例如：家常菜、川菜、粤菜" />
        </DuplicateFormItem>
      </FormModal>
    </PageShell>
  );
}
