import { useState } from 'react';
import { Button, Card, Input, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';

import { PageShell } from '../../components/PageShell';
import { FormModal } from '../../components/FormModal';
import { DuplicateFormItem } from '../../components/DuplicateFormItem';
import { DuplicateNameInput } from '../../components/DuplicateNameInput';
import { useValidationSession } from '../../hooks/useValidationSession';
import {
  useCreatePracticeGroup,
  useDeletePracticeGroup,
  usePractices,
  useUpdatePracticeGroup,
} from '../../features/recipe/usePractices';
import type { PracticeGroupDTO, PracticeOptionDTO, PracticeOptionItem } from '../../api/recipe';

/** 当前可编辑的那一格：分组名 g-{groupId}、选项名 o-{optionId}、新增选项 new-{groupId} */
const groupKey = (groupId: number) => `g-${groupId}`;
const optionKey = (optionId: number) => `o-${optionId}`;
const addKey = (groupId: number) => `new-${groupId}`;

interface CreateGroupFormValues {
  name: string;
}

/**
 * 做法管理页：一行一个做法分组，展示组名、关联菜品数量和组内选项。
 *
 * 全都在表格里直接改，没有编辑弹窗：点组名或选项名变输入框，回车/失焦保存；选项的 x 删单个选项，
 * 名字后面那个虚线 + 加一个选项。三次动作走同一个 `PUT /practices/{id}`（组名 + 整组选项），
 * 已有选项都带着自己的 id 回传，所以改名不换 id——购物车和订单快照里的做法 JSON 存的就是 optionId。
 * 空名、组内重名不提交；由服务端全域预检并保留无效草稿，写接口最终兜底。
 *
 * 分组和选项都不排序（后端按录入顺序返回），C 端详情浮层默认选中组内第一个选项。
 * 「关联菜品数量」是这组做法被多少道菜勾了——已删除的菜不算，下架的仍算。
 */
export function PracticeManagePage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { capture } = useValidationSession(isCreateOpen);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const { data: groups, isFetching } = usePractices();
  const createMutation = useCreatePracticeGroup();
  const updateMutation = useUpdatePracticeGroup();
  const deleteGroupMutation = useDeletePracticeGroup();

  /** 提交整组：已有选项一律带 id 回传，只有新增的那条没有；成功后才结束编辑。 */
  const submit = (record: PracticeGroupDTO, name: string, options: PracticeOptionItem[]) =>
    updateMutation.mutateAsync({ id: record.id, name, options });

  const handleSaveGroupName = async (record: PracticeGroupDTO, name: string) => {
    if (name === record.name) return;
    await submit(record, name, record.options.map((option) => ({ id: option.id, name: option.name })));
  };

  const handleSaveOptionName = async (record: PracticeGroupDTO, option: PracticeOptionDTO, name: string) => {
    if (name === option.name) return;
    await submit(record, record.name,
      record.options.map((item) => ({ id: item.id, name: item.id === option.id ? name : item.name })),
    );
  };

  const handleDeleteOption = (record: PracticeGroupDTO, option: PracticeOptionDTO) => {
    if (editingKey !== null || updateMutation.isPending) return;
    void submit(record, record.name, record.options
      .filter((item) => item.id !== option.id)
      .map((item) => ({ id: item.id, name: item.name })),
    ).catch(() => { /* mutation 已提示 */ });
  };

  const handleAddOption = (record: PracticeGroupDTO, name: string) =>
    submit(record, record.name, [
      ...record.options.map((item) => ({ id: item.id, name: item.name })),
      { name },
    ]);

  const handleCreate = async (values: CreateGroupFormValues) => {
    const isCurrent = capture();
    await createMutation.mutateAsync(values.name.trim());
    if (isCurrent()) setIsCreateOpen(false);
  };

  const startEdit = (key: string) => {
    if (editingKey === null && !updateMutation.isPending) setEditingKey(key);
  };

  const columns: ColumnsType<PracticeGroupDTO> = [
    {
      title: '分组名称',
      dataIndex: 'name',
      width: 200,
      render: (name: string, record) =>
        editingKey === groupKey(record.id) ? (
          <DuplicateNameInput
            key={groupKey(record.id)}
            initialValue={name}
            duplicate={{ kind: 'PRACTICE_GROUP', excludeId: record.id }}
            requiredMessage="请输入分组名称"
            onSave={(value) => handleSaveGroupName(record, value)}
            onSaved={() => setEditingKey(null)}
            onCancel={() => setEditingKey(null)}
            autoFocus
          />
        ) : (
          <Typography.Text
            onClick={() => startEdit(groupKey(record.id))}
            style={{ cursor: 'text' }}
          >
            {name}
          </Typography.Text>
        ),
    },
    {
      title: '关联菜品数量',
      dataIndex: 'recipeCount',
      width: 140,
      render: (count: number) => count ?? 0,
    },
    {
      title: '选项',
      dataIndex: 'options',
      render: (options: PracticeOptionDTO[], record) => (
        <Space size={4} wrap>
          {options.map((option) =>
            editingKey === optionKey(option.id) ? (
              <DuplicateNameInput
                key={option.id}
                size="small"
                initialValue={option.name}
                duplicate={{ kind: 'PRACTICE_OPTION', groupId: record.id, excludeId: option.id }}
                requiredMessage="请输入选项名称"
                onSave={(value) => handleSaveOptionName(record, option, value)}
                onSaved={() => setEditingKey(null)}
                onCancel={() => setEditingKey(null)}
                autoFocus
                style={{ width: 140 }}
              />
            ) : (
              <Tag
                key={option.id}
                closable
                onClose={(e) => {
                  // 挡掉 antd 自带的那次隐藏，删除结果跟着服务端刷新走
                  e.preventDefault();
                  handleDeleteOption(record, option);
                }}
              >
                <Typography.Text
                  onClick={() => startEdit(optionKey(option.id))}
                  style={{ cursor: 'text' }}
                >
                  {option.name}
                </Typography.Text>
              </Tag>
            ),
          )}
          {editingKey === addKey(record.id) ? (
            <DuplicateNameInput
              key={addKey(record.id)}
              size="small"
              placeholder="选项名称"
              duplicate={{ kind: 'PRACTICE_OPTION', groupId: record.id }}
              requiredMessage="请输入选项名称"
              onSave={(value) => handleAddOption(record, value)}
              onSaved={() => setEditingKey(null)}
              onCancel={() => setEditingKey(null)}
              autoFocus
              style={{ width: 140 }}
            />
          ) : (
            <Tag
              style={{ borderStyle: 'dashed', cursor: 'pointer' }}
              onClick={() => startEdit(addKey(record.id))}
            >
              <PlusOutlined />
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="确定删除此分组吗？"
          description="组内选项和菜品关联将一并删除"
          onConfirm={() => deleteGroupMutation.mutate(record.id)}
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
    <PageShell title="做法管理">
      <Card
        variant="borderless"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateOpen(true)}
          >
            新建分组
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={groups ?? []}
          loading={isFetching}
          pagination={false}
        />
      </Card>

      <FormModal<CreateGroupFormValues>
        open={isCreateOpen}
        title="新建分组"
        onSubmit={handleCreate}
        confirmLoading={createMutation.isPending}
        onClose={() => setIsCreateOpen(false)}
      >
        <DuplicateFormItem
          name="name"
          label="分组名称"
          active={isCreateOpen}
          duplicate={{ kind: 'PRACTICE_GROUP' }}
          rules={[{ required: true, whitespace: true, message: '请输入分组名称' }]}
        >
          <Input placeholder="例如：辣度、糖" autoFocus />
        </DuplicateFormItem>
      </FormModal>
    </PageShell>
  );
}
