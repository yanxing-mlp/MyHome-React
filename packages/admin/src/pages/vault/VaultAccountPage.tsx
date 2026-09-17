import { useState } from 'react';
import { Button, Input, Space, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { revealVaultPassword } from '../../api/vault';
import type { VaultAccount } from '../../api/vault';
import { PageShell } from '../../components/PageShell';
import { ResponsiveList } from '../../components/ResponsiveList';
import { TimeText } from '../../components/TimeText';
import { useApiMutation } from '../../hooks/useApiMutation';
import { VaultAccountActions } from '../../features/vault/VaultAccountActions';
import { VaultAccountFormModal } from '../../features/vault/VaultAccountFormModal';
import { VaultPasswordModal } from '../../features/vault/VaultPasswordModal';
import { useVaultAccounts } from '../../features/vault/useVaultAccounts';

const PAGE_SIZE = 20;

/**
 * 账号本（v5 需求）。
 *
 * 这一页是第一个真实接后端的管理页，也是"组件化清单"（方案 §7.4）的样板：
 * 页面只管三件事 —— 查询条件 state、两份渲染（列定义 / 卡片）、弹窗开关；
 * 排版在 PageShell，断点切换在 ResponsiveList，写操作在 useApiMutation，
 * 域内的按钮组与弹窗在 features/vault。
 */
export function VaultAccountPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageNo, setPageNo] = useState(1);

  const [formState, setFormState] = useState<{ open: boolean; record: VaultAccount | null }>({
    open: false,
    record: null,
  });
  const [revealTarget, setRevealTarget] = useState<VaultAccount | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  const { data, isFetching } = useVaultAccounts({
    keyword: keyword || undefined,
    pageNo,
    pageSize: PAGE_SIZE,
  });

  const revealMutation = useApiMutation(revealVaultPassword, {
    onSettledSuccess: (result) => setRevealed(result.password),
  });

  const handleReveal = (record: VaultAccount) => {
    setRevealTarget(record);
    setRevealed(null);
    revealMutation.mutate(record.id);
  };

  const columns: NonNullable<TableProps<VaultAccount>['columns']> = [
    { title: '平台名称', dataIndex: 'name', width: 160 },
    { title: '账号', dataIndex: 'account', width: 220 },
    {
      title: '添加时间',
      dataIndex: 'createTime',
      width: 160,
      render: (value: string) => <TimeText value={value} />,
    },
    {
      title: '修改时间',
      dataIndex: 'updateTime',
      width: 160,
      render: (value: string) => <TimeText value={value} />,
    },
    // 口令列**不存在**：接口不返回，这里也没有可渲染的东西（方案 §5.3）
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_, record) => (
        <VaultAccountActions
          record={record}
          onEdit={(r) => setFormState({ open: true, record: r })}
          onReveal={handleReveal}
        />
      ),
    },
  ];

  return (
    <PageShell
      title="账号本"
      actions={
        <Button type="primary" onClick={() => setFormState({ open: true, record: null })}>
          新增账号
        </Button>
      }
      toolbar={
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="搜索平台名称或账号"
            style={{ width: 260 }}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onSearch={(value) => {
              setKeyword(value.trim());
              setPageNo(1);
            }}
          />
          <Tag>{`共 ${data?.total ?? 0} 条`}</Tag>
        </Space>
      }
    >
      <ResponsiveList<VaultAccount>
        items={data?.list ?? []}
        keyOf={(item) => item.id}
        columns={columns}
        loading={isFetching}
        emptyText="还没有账号，点右上角「新增账号」"
        pagination={{
          current: pageNo,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onChange: setPageNo,
        }}
        renderCard={(item) => (
          <Space orientation="vertical" size={4} style={{ width: '100%' }}>
            <Space orientation="vertical" size={2}>
              <Typography.Text strong>{item.name}</Typography.Text>
              <Typography.Text type="secondary">{item.account}</Typography.Text>
              <Space separator="·">
                <TimeText value={item.createTime} label="添加" />
                <TimeText value={item.updateTime} label="修改" />
              </Space>
            </Space>
            <Space wrap>
              <VaultAccountActions
                record={item}
                onEdit={(r) => setFormState({ open: true, record: r })}
                onReveal={handleReveal}
              />
            </Space>
          </Space>
        )}
      />

      <VaultAccountFormModal
        open={formState.open}
        record={formState.record}
        onClose={() => setFormState({ open: false, record: null })}
      />

      <VaultPasswordModal
        open={revealTarget !== null}
        label={revealTarget ? `${revealTarget.name} / ${revealTarget.account}` : ''}
        password={revealed}
        loading={revealMutation.isPending}
        onClose={() => {
          setRevealTarget(null);
          setRevealed(null);
        }}
      />
    </PageShell>
  );
}
