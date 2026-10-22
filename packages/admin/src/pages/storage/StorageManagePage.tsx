import { useRef, useState } from 'react';
import { Alert, App, Button, Card, Empty, Modal, Progress, Result, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import type { TableProps } from 'antd';
import { ArrowUpOutlined, FolderOutlined, HddOutlined, PlusOutlined, QuestionCircleOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';
import { createStorageDirectory, fetchStorage, fetchStorageFolders, setDefaultStorageDirectory } from '../../api/storage';
import type { StorageDirectory } from '../../api/storage';
import { PageShell } from '../../components/PageShell';
import { ResponsiveList } from '../../components/ResponsiveList';
import { TimeText } from '../../components/TimeText';
import { useValidationSession } from '../../hooks/useValidationSession';
import { withIdentity } from '../../lib/http';

const REFRESH_INTERVAL = 10_000;
const WRAP_STYLE = { overflowWrap: 'anywhere', whiteSpace: 'normal', minWidth: 0 } as const;

type StorageAction = { type: 'add'; path: string } | { type: 'default'; id: number };

function formatCapacity(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '未知';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const index = bytes === 0 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function canSetDefault(directory: StorageDirectory, defaultId?: number): boolean {
  return !directory.isDefault && directory.id !== defaultId && directory.available && directory.writable
    && !directory.error && directory.usableBytes != null && directory.usableBytes > 0;
}

function DirectoryPaths({ directory }: { directory: StorageDirectory }) {
  return (
    <div style={WRAP_STYLE}>
      <div><Typography.Text type="secondary">公共目录：</Typography.Text>{directory.path}</div>
      <div><Typography.Text type="secondary">私人目录：</Typography.Text>{directory.privatePath}</div>
    </div>
  );
}

function DirectoryStatus({ directory, isDefault }: { directory: StorageDirectory; isDefault: boolean }) {
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%', ...WRAP_STYLE }}>
      <Space wrap size={[4, 4]}>
        {isDefault && <Tag color="blue">默认上传</Tag>}
        {!directory.available && <Tag color="error">不可用</Tag>}
        {!directory.writable && <Tag color="error">不可写</Tag>}
        {directory.usableBytes != null && directory.usableBytes <= 0 && <Tag color="error">无剩余空间</Tag>}
        {directory.available && directory.writable && !directory.error && (
          directory.usableBytes == null
            ? <Tag color="warning">可用容量未知</Tag>
            : directory.usableBytes > 0 && <Tag color="success">可用</Tag>
        )}
      </Space>
      {directory.error && <Typography.Text type="danger" style={WRAP_STYLE}>{directory.error}</Typography.Text>}
    </Space>
  );
}

function DirectoryUsageTitle() {
  return (
    <Space size={4}>
      目录占用
      <Tooltip title="公共目录和配套私人目录内的文件大小合计，包含缩略图；能识别的硬链接去重，不跟随符号链接或其他挂载盘。不等同磁盘块分配大小。后台统计完成后，间隔至少 60 秒更新，文件系统不支持文件标识时按文件项计数。">
        <QuestionCircleOutlined aria-label="目录占用统计口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
    </Space>
  );
}

function DirectoryUsage({ directory, showTitle = false }: { directory: StorageDirectory; showTitle?: boolean }) {
  const { directoryBytes, directoryScannedAt, directoryScanning, directoryError, available } = directory;
  const hasSize = available && !directoryError && directoryBytes != null && Number.isFinite(directoryBytes) && directoryBytes >= 0;
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%', ...WRAP_STYLE }}>
      <Space wrap size={6}>
        {showTitle && <DirectoryUsageTitle />}
        <Typography.Text strong>{hasSize ? formatCapacity(directoryBytes) : available && directoryScanning ? '统计中' : '未知'}</Typography.Text>
        {available && hasSize && directoryScanning && <Tag>统计中</Tag>}
      </Space>
      {hasSize && <TimeText value={directoryScannedAt} label="统计时间" />}
      {directoryError && <Typography.Text type="danger" style={WRAP_STYLE}>{directoryError}</Typography.Text>}
    </Space>
  );
}

function DirectoryCapacity({ directory }: { directory: StorageDirectory }) {
  const { totalBytes, usedBytes, usableBytes } = directory;
  const percent = totalBytes != null && totalBytes > 0 && usedBytes != null && usedBytes >= 0
    ? Math.min(100, Math.max(0, Math.round(usedBytes / totalBytes * 1000) / 10))
    : null;
  return (
    <div style={WRAP_STYLE}>
      <div>磁盘总量：{formatCapacity(totalBytes)}</div>
      <div>磁盘已用：{formatCapacity(usedBytes)}</div>
      <div>磁盘可用：{formatCapacity(usableBytes)}</div>
      {percent != null && (
        <Progress percent={percent} size="small" status={usableBytes != null && usableBytes <= 0 ? 'exception' : 'normal'} />
      )}
    </div>
  );
}

function CreateDirectoryModal({ userId, pending, error, onSubmit, onClose, onChange }: {
  userId: number;
  pending: boolean;
  error: Error | null;
  onSubmit: (path: string) => void;
  onClose: () => void;
  onChange: () => void;
}) {
  const [path, setPath] = useState<string>();
  const foldersQuery = useQuery({
    queryKey: ['storage-folders', userId, path ?? null],
    queryFn: ({ signal }) => fetchStorageFolders(path, { ...withIdentity(String(userId)), signal }),
    enabled: !pending,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  // 导航、刷新和失败期间不能拿上一份目录信息提交。
  const listing = foldersQuery.isFetching || foldersQuery.isError ? undefined : foldersQuery.data;
  const navigate = (nextPath?: string) => {
    if (pending) return;
    onChange();
    setPath(nextPath);
  };
  const refresh = () => {
    onChange();
    void foldersQuery.refetch();
  };
  return (
    <Modal
      open
      title="选择存储目录"
      okText="新增目录"
      cancelText="取消"
      width={560}
      destroyOnHidden
      confirmLoading={pending}
      okButtonProps={{ disabled: pending || !listing?.path || !listing.selectable }}
      cancelButtonProps={{ disabled: pending }}
      closable={!pending}
      keyboard={!pending}
      onCancel={() => { if (!pending) onClose(); }}
      onOk={() => { if (!pending && listing?.path && listing.selectable) onSubmit(listing.path); }}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%', ...WRAP_STYLE }}>
        <Space wrap>
          <Button icon={<HddOutlined />} disabled={pending || path == null} onClick={() => navigate()}>服务器</Button>
          <Button icon={<ArrowUpOutlined />} disabled={pending || !listing?.path} onClick={() => navigate(listing?.parentPath ?? undefined)}>上一级</Button>
          <Button icon={<ReloadOutlined />} aria-label="刷新目录" disabled={pending || foldersQuery.isFetching} onClick={refresh} />
        </Space>
        <Typography.Text style={WRAP_STYLE}>{listing?.path ?? path ?? '服务器'}</Typography.Text>
        {error && <Alert type="error" showIcon title={error.message} />}
        {foldersQuery.isError ? (
          <Alert type="error" showIcon title={foldersQuery.error.message} />
        ) : !listing ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin aria-label="正在读取服务器目录" /></div>
        ) : (
          <>
            {listing.disabledReason && <Alert type="warning" showIcon title={listing.disabledReason} />}
            <div role="group" aria-label="服务器文件夹" style={{ width: '100%', maxHeight: 320, overflowY: 'auto', overflowX: 'hidden' }}>
              {listing.directories.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有子文件夹" /> : (
                <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                  {listing.directories.map((folder) => (
                    <Button
                      key={folder.path}
                      block
                      disabled={pending || !folder.enterable}
                      onClick={() => navigate(folder.path)}
                      style={{ height: 'auto', padding: '10px 12px', textAlign: 'left', ...WRAP_STYLE }}
                    >
                      <FolderOutlined />
                      <span style={{ flex: 1, ...WRAP_STYLE }}>
                        <span style={{ display: 'block' }}>{folder.name}</span>
                        {folder.disabledReason && <span style={{ display: 'block', fontSize: 12 }}>{folder.disabledReason}</span>}
                      </span>
                      {folder.enterable && <RightOutlined />}
                    </Button>
                  ))}
                </Space>
              )}
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
}

/** 先隔离权限再挂载数据组件，普通成员不会创建任何存储查询。 */
export function StorageManagePage() {
  const user = useCurrentUser();
  if (!user || !can(user, PERMISSION.STORAGE_ACCESS)) return <Result status="403" title="只有超级管理员能管理存储" />;
  return <AdminStorageContent key={user.id} userId={user.id} />;
}

function AdminStorageContent({ userId }: { userId: number }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { capture } = useValidationSession();
  const queryKey = ['storage', userId] as const;
  const [createOpen, setCreateOpen] = useState(false);
  const [addedId, setAddedId] = useState<number | null>(null);
  const actionLock = useRef(false);

  const mutation = useMutation<number | void, Error, StorageAction, { isCurrent: () => boolean }>({
    retry: false,
    onMutate: async () => {
      const isCurrent = capture();
      // 写入前取消在途轮询，写入完成后再读取，避免旧快照覆盖新默认目录。
      await queryClient.cancelQueries({ queryKey, exact: true });
      return { isCurrent };
    },
    mutationFn: (action) => {
      if (!capture()()) throw new Error('页面已切换，请重新操作');
      const config = withIdentity(String(userId));
      return action.type === 'add'
        ? createStorageDirectory({ path: action.path }, config)
        : setDefaultStorageDirectory(action.id, config);
    },
    onSuccess: async (id, action, session) => {
      if (!session?.isCurrent()) return;
      if (action.type === 'add') {
        setAddedId(typeof id === 'number' ? id : null);
        setCreateOpen(false);
        message.success('目录已新增，默认上传目录未改变');
      } else {
        message.success('默认上传目录已更新');
      }
      await storageQuery.refetch({ cancelRefetch: false });
    },
    onSettled: () => { actionLock.current = false; },
  });

  const storageQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchStorage({ ...withIdentity(String(userId)), signal }),
    enabled: !mutation.isPending,
    staleTime: REFRESH_INTERVAL,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
  });

  // 后台刷新失败也隐藏上次快照；不能把旧默认路径/容量继续伪装成实时数据。
  const overview = storageQuery.isError ? undefined : storageQuery.data;
  const defaultDirectory = overview?.directories.find((directory) => directory.id === overview.defaultDirectoryId);
  const runAction = (action: StorageAction) => {
    if (actionLock.current || mutation.isPending) return;
    actionLock.current = true;
    mutation.mutate(action);
  };
  const renderAction = (directory: StorageDirectory) => (
    <Button
      size="small"
      disabled={mutation.isPending || storageQuery.isFetching || !canSetDefault(directory, overview?.defaultDirectoryId)}
      loading={mutation.isPending && mutation.variables?.type === 'default' && mutation.variables.id === directory.id}
      onClick={() => runAction({ type: 'default', id: directory.id })}
    >
      设为默认
    </Button>
  );
  const renderStatus = (directory: StorageDirectory) => (
    <DirectoryStatus directory={directory} isDefault={directory.isDefault || directory.id === overview?.defaultDirectoryId} />
  );
  const renderPaths = (directory: StorageDirectory) => (
    <>
      {directory.id === addedId && <Tag color="green">刚新增</Tag>}
      <DirectoryPaths directory={directory} />
    </>
  );
  const columns: NonNullable<TableProps<StorageDirectory>['columns']> = [
    { title: '关联目录（服务器路径）', key: 'path', width: 340, render: (_, directory) => <div style={{ maxWidth: 340 }}>{renderPaths(directory)}</div> },
    { title: <DirectoryUsageTitle />, key: 'directoryUsage', width: 200, render: (_, directory) => <DirectoryUsage directory={directory} /> },
    { title: '磁盘', dataIndex: 'volume', width: 160, render: (volume: string | null) => <div style={{ maxWidth: 160, ...WRAP_STYLE }}>{volume ?? '未知'}</div> },
    { title: '磁盘容量', key: 'capacity', width: 220, render: (_, directory) => <DirectoryCapacity directory={directory} /> },
    { title: '状态', key: 'status', width: 180, render: (_, directory) => <div style={{ maxWidth: 180 }}>{renderStatus(directory)}</div> },
    { title: '操作', key: 'actions', width: 110, render: (_, directory) => renderAction(directory) },
  ];

  return (
    <PageShell
      title="目录管理"
      actions={
        <>
          <Button
            icon={<ReloadOutlined />}
            loading={storageQuery.isFetching}
            disabled={mutation.isPending || storageQuery.isFetching}
            onClick={() => void storageQuery.refetch({ cancelRefetch: false })}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} disabled={mutation.isPending} onClick={() => { mutation.reset(); setCreateOpen(true); }}>
            新增目录
          </Button>
        </>
      }
      toolbar={
        <Space wrap>
          <Tag>每 10 秒刷新</Tag>
          {overview && <Tag>共 {overview.directories.length} 个目录</Tag>}
          {overview && <TimeText value={overview.refreshedAt} label="刷新时间" />}
          {storageQuery.isFetching && <Typography.Text type="secondary">刷新中</Typography.Text>}
          {mutation.isPending && <Typography.Text type="secondary">更新中</Typography.Text>}
        </Space>
      }
    >
      {mutation.isError && mutation.variables?.type === 'default' && <Alert type="error" showIcon title={mutation.error.message} />}
      {storageQuery.isError ? (
        <Alert type="error" showIcon title="存储信息刷新失败" description={storageQuery.error.message} />
      ) : !overview ? (
        <Spin aria-label="正在读取存储信息" />
      ) : (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="当前默认上传目录（服务器路径）">
            {defaultDirectory ? <DirectoryPaths directory={defaultDirectory} /> : <Typography.Text type="warning">未找到默认目录</Typography.Text>}
          </Card>
          <ResponsiveList<StorageDirectory>
            items={overview.directories}
            keyOf={(directory) => directory.id}
            columns={columns}
            loading={storageQuery.isFetching || mutation.isPending}
            emptyText="暂无关联目录"
            renderCard={(directory) => (
              <Space orientation="vertical" size={12} style={{ width: '100%', ...WRAP_STYLE }}>
                {renderPaths(directory)}
                <DirectoryUsage directory={directory} showTitle />
                <div style={WRAP_STYLE}>磁盘：{directory.volume ?? '未知'}</div>
                <DirectoryCapacity directory={directory} />
                {renderStatus(directory)}
                {renderAction(directory)}
              </Space>
            )}
          />
        </Space>
      )}
      {createOpen && (
        <CreateDirectoryModal
          userId={userId}
          pending={mutation.isPending}
          error={mutation.isError && mutation.variables?.type === 'add' ? mutation.error : null}
          onSubmit={(path) => runAction({ type: 'add', path })}
          onChange={() => { if (mutation.isError) mutation.reset(); }}
          onClose={() => { setCreateOpen(false); mutation.reset(); }}
        />
      )}
    </PageShell>
  );
}
