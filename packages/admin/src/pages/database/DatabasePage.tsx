import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';
import {
  alterDbTable,
  backupDbNow,
  deleteDbBackup,
  deleteDbRow,
  fetchDbBackups,
  fetchDbColumns,
  fetchDbIndexes,
  fetchDbTableData,
  fetchDbTables,
  insertDbRow,
  runDbSql,
  saveDbSettings,
  updateDbRow,
  type DbAlterOp,
  type DbIndex,
  type DbRow,
  type DbSqlResult,
  type DbTable,
} from '../../api/database';
import { PageShell } from '../../components/PageShell';
import { FormModal } from '../../components/FormModal';
import { useApiMutation } from '../../hooks/useApiMutation';
import { withIdentity } from '../../lib/http';

/** 可视化表格每页行数（后端 MAX_PAGE_SIZE=200，这里取一个日常够用的值）。 */
const PAGE_SIZE = 20;
/** 备份保留天数区间（与后端 MIN/MAX 一致）。 */
const RETENTION_MIN = 1;
const RETENTION_MAX = 365;

/** 只读语句前缀：命中即直接执行，否则视为写 / DDL，前端二次确认后再跑。 */
const READ_ONLY_PREFIX = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/;

function isReadOnlySql(sql: string): boolean {
  // 剥掉开头的块注释再判前缀，避免 /* ... */ SELECT 被误判成写操作。
  const s = sql.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, '').toUpperCase();
  return READ_ONLY_PREFIX.test(s);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 单元格值 → 展示文本：null 显灰色 NULL，布尔显 true/false，其余转字符串。 */
function CellValue({ value }: { value: DbRow[string] }) {
  if (value === null || value === undefined) {
    return <Typography.Text type="secondary" style={{ fontSize: 12 }}>NULL</Typography.Text>;
  }
  if (typeof value === 'boolean') return <span>{value ? 'true' : 'false'}</span>;
  return <span>{String(value)}</span>;
}

/** 先隔离权限再挂载数据组件：无 database.access 者不创建任何查询（与代码仓库 / 系统日志页同一口径）。 */
export function DatabasePage() {
  const user = useCurrentUser();
  if (!user || !can(user, PERMISSION.DATABASE_ACCESS)) {
    return <Result status="403" title="只有超级管理员能访问数据库" />;
  }
  return <DatabaseContent key={user.id} userId={user.id} />;
}

function DatabaseContent({ userId }: { userId: number }) {
  const [tab, setTab] = useState('browse');

  const tablesQuery = useQuery({
    queryKey: ['db-tables', userId],
    queryFn: ({ signal }) => fetchDbTables({ ...withIdentity(String(userId)), signal }),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  const database = tablesQuery.data?.database ?? '';
  const tables = useMemo(() => tablesQuery.data?.tables ?? [], [tablesQuery.data]);

  const actions = (
    <Space size={8}>
      <Tooltip title="这一页直连部署机那个业务库，可视化浏览表数据、行内增删改、结构化改表结构、跑任意 SQL（读+写+DDL 全放开），并按天做整库备份。全系统权限最高的页，默认只有超级管理员能进；写操作与 SQL 里的写 / DDL 都有二次确认。">
        <QuestionCircleOutlined aria-label="数据库页口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <Button
        icon={<ReloadOutlined />}
        loading={tablesQuery.isFetching}
        onClick={() => void tablesQuery.refetch()}
      >
        刷新表
      </Button>
    </Space>
  );

  let body: ReactNode;
  if (tablesQuery.isLoading) {
    body = (
      <Space size={8}>
        <Spin aria-label="正在读取表清单" />
        <Typography.Text type="secondary">正在读取数据库表清单…</Typography.Text>
      </Space>
    );
  } else if (tablesQuery.isError) {
    body = <Alert type="error" showIcon message="读取表清单失败" description={tablesQuery.error.message} />;
  } else {
    body = (
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'browse',
            label: '数据浏览',
            children: (
              <DataBrowser
                userId={userId}
                tables={tables}
                onTablesChanged={() => void tablesQuery.refetch()}
              />
            ),
          },
          {
            key: 'structure',
            label: '表结构',
            children: (
              <StructureEditor
                userId={userId}
                tables={tables}
                onTablesChanged={() => void tablesQuery.refetch()}
              />
            ),
          },
          { key: 'sql', label: 'SQL 查询', children: <SqlConsole userId={userId} /> },
          { key: 'backup', label: '备份', children: <BackupPanel userId={userId} /> },
        ]}
      />
    );
  }

  return (
    <PageShell title={database ? `数据库 · ${database}` : '数据库'} actions={actions}>
      {body}
    </PageShell>
  );
}

// =====================================================================
// 数据浏览：左侧表清单 + 右侧分页表格 + 行内增删改
// =====================================================================

interface RowEditorState {
  mode: 'insert' | 'edit';
  /** 编辑时的原始行（含主键），新增时为 null。 */
  row: DbRow | null;
}

function DataBrowser({
  userId,
  tables,
  onTablesChanged,
}: {
  userId: number;
  tables: DbTable[];
  onTablesChanged: () => void;
}) {
  const [table, setTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<RowEditorState | null>(null);

  const dataQuery = useQuery({
    queryKey: ['db-data', userId, table, page],
    queryFn: ({ signal }) => fetchDbTableData(table!, page, PAGE_SIZE, { ...withIdentity(String(userId)), signal }),
    enabled: !!table,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  const data = dataQuery.data;
  const editable = data?.editable ?? false;
  const columns = data?.columns ?? [];
  const pkCols = useMemo(() => columns.filter((c) => c.primaryKey).map((c) => c.name), [columns]);

  const invalidateData: QueryKey[] = [['db-data', userId, table, page]];

  const insertMutation = useApiMutation(
    (values: DbRow) => insertDbRow(table!, values, withIdentity(String(userId))),
    { invalidate: invalidateData, successMessage: '已新增' },
  );
  const updateMutation = useApiMutation(
    ({ pk, values }: { pk: DbRow; values: DbRow }) => updateDbRow(table!, pk, values, withIdentity(String(userId))),
    { invalidate: invalidateData, successMessage: '已保存' },
  );
  const deleteMutation = useApiMutation(
    (pk: DbRow) => deleteDbRow(table!, pk, withIdentity(String(userId))),
    {
      invalidate: invalidateData,
      successMessage: '已删除',
      onSettledSuccess: onTablesChanged,
    },
  );

  const onSelectTable = (name: string) => {
    setTable(name);
    setPage(1);
  };

  // 表单初值：编辑回填整行（null → 空串），新增全空。字段顺序跟随表格列。
  const formInitial = useMemo<Record<string, string>>(() => {
    if (!editor) return {};
    const out: Record<string, string> = {};
    for (const c of columns) {
      const v = editor.row ? editor.row[c.name] : null;
      out[c.name] = v === null || v === undefined ? '' : String(v);
    }
    return out;
  }, [editor, columns]);

  const submitRow = (formValues: Record<string, string>) => {
    // 空串一律当 null 提交（新增时 auto_increment 主键收到 null 会自动分配）。
    const values: DbRow = {};
    for (const c of columns) {
      const text = formValues[c.name];
      values[c.name] = text === undefined || text === '' ? null : text;
    }
    if (editor?.mode === 'insert') {
      insertMutation.mutate(values, {
        onSuccess: () => {
          setEditor(null);
          onTablesChanged();
        },
      });
    } else if (editor?.mode === 'edit' && editor.row) {
      const pk: DbRow = {};
      for (const name of pkCols) pk[name] = editor.row[name] ?? null;
      updateMutation.mutate(
        { pk, values },
        { onSuccess: () => setEditor(null) },
      );
    }
  };

  const tableColumns: TableColumnsType<DbRow & { __rk: number }> = [
    ...columns.map((c) => ({
      title: (
        <Space size={4}>
          {c.primaryKey && <KeyOutlined style={{ color: '#faad14' }} aria-label="主键" />}
          <span>{c.name}</span>
        </Space>
      ),
      dataIndex: c.name,
      key: c.name,
      ellipsis: true,
      render: (v: DbRow[string]) => <CellValue value={v} />,
    })),
  ];
  if (editable) {
    tableColumns.push({
      title: '操作',
      key: '__op',
      fixed: 'right',
      width: 120,
      render: (_: unknown, row: DbRow & { __rk: number }) => (
        <Space size={4}>
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => setEditor({ mode: 'edit', row })}
          >
            改
          </Button>
          <Popconfirm
            title="删除这一行？"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => {
              const pk: DbRow = {};
              for (const name of pkCols) pk[name] = row[name] ?? null;
              deleteMutation.mutate(pk);
            }}
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删
            </Button>
          </Popconfirm>
        </Space>
      ),
    });
  }

  const dataSource = (data?.rows ?? []).map((r, i) => ({ ...r, __rk: i }));

  const list = (
    <div
      style={{
        width: 240,
        flex: 'none',
        maxHeight: 'calc(100vh - 260px)',
        minHeight: 320,
        overflow: 'auto',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
      }}
    >
      {tables.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="库里没有表" style={{ marginTop: 40 }} />
      ) : (
        tables.map((t) => {
          const active = t.name === table;
          return (
            <div
              key={t.name}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTable(t.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectTable(t.name);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #f5f5f5',
                background: active ? '#e6f4ff' : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Tooltip title={t.comment || undefined} placement="right">
                <span style={{ fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                </span>
              </Tooltip>
              <Typography.Text type="secondary" style={{ fontSize: 12, flex: 'none' }}>
                {t.rows}
              </Typography.Text>
            </div>
          );
        })
      )}
    </div>
  );

  let right: ReactNode;
  if (!table) {
    right = <Empty description="从左侧选择一张表查看数据" />;
  } else if (dataQuery.isLoading) {
    right = (
      <Space size={8}>
        <Spin aria-label="正在读取表数据" />
        <Typography.Text type="secondary">正在读取「{table}」…</Typography.Text>
      </Space>
    );
  } else if (dataQuery.isError) {
    right = <Alert type="error" showIcon message="读取表数据失败" description={dataQuery.error.message} />;
  } else {
    right = (
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <Typography.Text strong>{table}</Typography.Text>
          {!editable && <Tag color="orange">无主键 · 只读</Tag>}
          <span style={{ flex: 1 }} />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!editable}
            onClick={() => setEditor({ mode: 'insert', row: null })}
          >
            新增行
          </Button>
        </Space>
        {!editable && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            该表没有主键，无法安全定位唯一行，行内改 / 删已禁用；如需修改请到「SQL 查询」页操作。
          </Typography.Text>
        )}
        <Table
          size="small"
          rowKey="__rk"
          loading={dataQuery.isFetching}
          columns={tableColumns}
          dataSource={dataSource}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
        />
      </Space>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {list}
      <div style={{ flex: 1, minWidth: 0 }}>{right}</div>

      <FormModal<Record<string, string>>
        open={!!editor}
        title={editor?.mode === 'insert' ? '新增行' : '编辑行'}
        initialValues={formInitial}
        confirmLoading={insertMutation.isPending || updateMutation.isPending}
        onSubmit={submitRow}
        onClose={() => setEditor(null)}
        width={560}
      >
        {columns.map((c) => (
          <Form.Item key={c.name} name={c.name} label={c.name} style={{ marginBottom: 12 }}>
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 4 }}
              aria-label={c.name}
              placeholder={c.primaryKey && editor?.mode === 'insert' ? '留空自动分配' : undefined}
            />
          </Form.Item>
        ))}
      </FormModal>
    </div>
  );
}

// =====================================================================
// 表结构：结构化表单改列（加 / 改 / 删）
// =====================================================================

interface AlterState {
  action: 'add' | 'modify' | 'drop';
  /** modify / drop 时锁定的列名。 */
  name?: string;
}

interface AlterFormValues {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string;
  comment: string;
  after: string;
}

function StructureEditor({
  userId,
  tables,
  onTablesChanged,
}: {
  userId: number;
  tables: DbTable[];
  onTablesChanged: () => void;
}) {
  const [table, setTable] = useState<string | null>(null);
  const [alter, setAlter] = useState<AlterState | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);

  const columnsQuery = useQuery({
    queryKey: ['db-columns', userId, table],
    queryFn: ({ signal }) => fetchDbColumns(table!, { ...withIdentity(String(userId)), signal }),
    enabled: !!table,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  // 索引清单（只读）：与列结构同源同生命周期，改完结构一并 invalidate。
  const indexesQuery = useQuery({
    queryKey: ['db-indexes', userId, table],
    queryFn: ({ signal }) => fetchDbIndexes(table!, { ...withIdentity(String(userId)), signal }),
    enabled: !!table,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  const cols = columnsQuery.data?.columns ?? [];
  const idxs = indexesQuery.data?.indexes ?? [];

  // 当前表的说明（MySQL 表注释）：随表清单一起返回，改完后 invalidate db-tables 即刷新。
  const currentComment = useMemo(
    () => tables.find((t) => t.name === table)?.comment ?? '',
    [tables, table],
  );

  const alterMutation = useApiMutation(
    (op: DbAlterOp) => alterDbTable(table!, op, withIdentity(String(userId))),
    {
      invalidate: [
        ['db-columns', userId, table],
        ['db-indexes', userId, table],
        ['db-tables', userId],
      ],
      successMessage: '表结构已更新',
      onSettledSuccess: () => {
        setAlter(null);
        onTablesChanged();
      },
    },
  );

  const commentMutation = useApiMutation(
    (comment: string) =>
      alterDbTable(table!, { action: 'comment', name: '', comment }, withIdentity(String(userId))),
    {
      invalidate: [
        ['db-tables', userId],
        ['db-columns', userId, table],
      ],
      successMessage: '表说明已保存',
      onSettledSuccess: () => {
        setCommentOpen(false);
        onTablesChanged();
      },
    },
  );

  const options = useMemo(() => tables.map((t) => ({ value: t.name, label: t.name })), [tables]);

  const submitAlter = (v: AlterFormValues) => {
    if (!alter) return;
    const op: DbAlterOp =
      alter.action === 'drop'
        ? { action: 'drop', name: alter.name ?? v.name }
        : {
            action: alter.action,
            name: alter.action === 'modify' ? alter.name ?? v.name : v.name.trim(),
            dataType: v.dataType.trim(),
            nullable: v.nullable,
            defaultValue: v.defaultValue === '' ? null : v.defaultValue,
            comment: v.comment,
            after: alter.action === 'add' ? v.after : undefined,
          };
    alterMutation.mutate(op);
  };

  const initialAlter = useMemo<AlterFormValues>(() => {
    if (!alter) return { name: '', dataType: '', nullable: true, defaultValue: '', comment: '', after: '' };
    if (alter.action === 'modify' && alter.name) {
      const c = cols.find((x) => x.name === alter.name);
      return {
        name: alter.name,
        dataType: c?.type ?? '',
        nullable: c?.nullable ?? true,
        defaultValue: c?.defaultValue ?? '',
        comment: c?.comment ?? '',
        after: '',
      };
    }
    if (alter.action === 'drop') {
      return { name: alter.name ?? '', dataType: '', nullable: true, defaultValue: '', comment: '', after: '' };
    }
    return { name: '', dataType: '', nullable: true, defaultValue: '', comment: '', after: '' };
  }, [alter, cols]);

  const structureColumns: TableColumnsType<(typeof cols)[number]> = [
    { title: '列名', dataIndex: 'name', key: 'name', render: (v: string, r) => (
      <Space size={4}>{r.primaryKey && <KeyOutlined style={{ color: '#faad14' }} aria-label="主键" />}<span>{v}</span></Space>
    ) },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '可空', dataIndex: 'nullable', key: 'nullable', render: (v: boolean) => (v ? 'YES' : 'NO') },
    { title: '键', dataIndex: 'key', key: 'key', render: (v: string) => v || '—' },
    { title: '默认值', dataIndex: 'defaultValue', key: 'defaultValue', render: (v: string | null) => (v === null || v === '' ? '—' : v) },
    { title: '额外', dataIndex: 'extra', key: 'extra', render: (v: string) => v || '—' },
    { title: '注释', dataIndex: 'comment', key: 'comment', ellipsis: true, render: (v: string) => v || '—' },
    {
      title: '操作',
      key: '__op',
      width: 160,
      render: (_: unknown, r) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => setAlter({ action: 'modify', name: r.name })}>
            改
          </Button>
          <Popconfirm
            title={`删除列「${r.name}」？`}
            description="该列的所有数据会一并丢失，不可恢复。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => alterMutation.mutate({ action: 'drop', name: r.name })}
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 索引清单列：一个索引一行，列名（有序）用 Tag 串起来，唯一性/类型/可见性各一列。
  const indexColumns: TableColumnsType<DbIndex> = [
    {
      title: '索引名',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r) => (
        <Space size={4}>
          {r.name === 'PRIMARY' && <KeyOutlined style={{ color: '#faad14' }} aria-label="主键" />}
          <span>{v || '—'}</span>
        </Space>
      ),
    },
    {
      title: '唯一',
      dataIndex: 'unique',
      key: 'unique',
      width: 72,
      render: (v: boolean) => (v ? <Tag color="gold">唯一</Tag> : <Tag>普通</Tag>),
    },
    {
      title: '列（有序）',
      dataIndex: 'columns',
      key: 'columns',
      render: (cols: string[]) =>
        cols && cols.length ? (
          <Space size={4} wrap>
            {cols.map((c, i) => (
              <Tag key={`${c}-${i}`} style={{ marginInlineEnd: 0 }}>
                {i > 0 && <span style={{ color: '#bbb', marginRight: 4 }}>{i + 1}</span>}
                {c}
              </Tag>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 96, render: (v: string) => v || '—' },
    {
      title: '可见',
      dataIndex: 'visible',
      key: 'visible',
      width: 72,
      render: (v: boolean) => (v ? 'YES' : <Typography.Text type="secondary">NO</Typography.Text>),
    },
    {
      title: '备注',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
  ];

  let body: ReactNode;
  if (!table) {
    body = <Empty description="选择一张表查看 / 修改结构" />;
  } else if (columnsQuery.isLoading) {
    body = (
      <Space size={8}>
        <Spin aria-label="正在读取表结构" />
        <Typography.Text type="secondary">正在读取「{table}」结构…</Typography.Text>
      </Space>
    );
  } else if (columnsQuery.isError) {
    body = <Alert type="error" showIcon message="读取表结构失败" description={columnsQuery.error.message} />;
  } else {
    body = (
      <Table
        size="small"
        rowKey="name"
        loading={columnsQuery.isFetching}
        columns={structureColumns}
        dataSource={cols}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    );
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Space size={8} wrap>
        <Select
          style={{ minWidth: 240 }}
          placeholder="选择表"
          value={table ?? undefined}
          options={options}
          onChange={(v) => setTable(v)}
          showSearch
        />
        <span style={{ flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!table} onClick={() => setAlter({ action: 'add' })}>
          新增列
        </Button>
      </Space>
      {table && (
        <Space size={8} wrap align="center">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>表说明</Typography.Text>
          {currentComment ? (
            <Typography.Text style={{ maxWidth: 520 }} ellipsis={{ tooltip: currentComment }}>
              {currentComment}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">（未设置）</Typography.Text>
          )}
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => setCommentOpen(true)}>
            修改说明
          </Button>
        </Space>
      )}
      {body}

      {table && (
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          <Space size={6} align="center">
            <Typography.Text strong>索引</Typography.Text>
            <Tooltip title="读自 SHOW INDEX：一个索引一行，「列（有序）」按 Seq_in_index 排列，前缀索引标成 列(长度)、函数索引显示表达式。此处只读，改索引请到 SQL 查询页执行 DDL。">
              <QuestionCircleOutlined style={{ color: '#999' }} aria-label="索引说明" />
            </Tooltip>
            {indexesQuery.data && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                共 {idxs.length} 个
              </Typography.Text>
            )}
          </Space>
          {indexesQuery.isError ? (
            <Alert type="error" showIcon message="读取索引失败" description={indexesQuery.error.message} />
          ) : idxs.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={indexesQuery.isLoading ? '正在读取索引…' : '这张表没有索引'}
            />
          ) : (
            <Table
              size="small"
              rowKey="name"
              loading={indexesQuery.isFetching}
              columns={indexColumns}
              dataSource={idxs}
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          )}
        </Space>
      )}

      <FormModal<AlterFormValues>
        open={!!alter}
        title={alter?.action === 'add' ? '新增列' : alter?.action === 'modify' ? '修改列' : '删除列'}
        initialValues={initialAlter}
        confirmLoading={alterMutation.isPending}
        onSubmit={submitAlter}
        onClose={() => setAlter(null)}
        okText={alter?.action === 'drop' ? '确认删除' : '保存'}
        width={520}
      >
        {alter?.action === 'drop' ? (
          <Alert type="warning" showIcon message={`将删除列「${alter.name}」，该列数据不可恢复。`} />
        ) : (
          <>
            <Form.Item
              name="name"
              label="列名"
              rules={[
                { required: true, message: '请输入列名' },
                { pattern: /^[A-Za-z0-9_]+$/, message: '只能包含字母、数字、下划线' },
              ]}
            >
              <Input disabled={alter?.action === 'modify'} aria-label="列名" placeholder="如 remark" />
            </Form.Item>
            <Form.Item name="dataType" label="类型" rules={[{ required: true, message: '请输入字段类型' }]}>
              <Input aria-label="类型" placeholder="如 VARCHAR(255) / INT / DECIMAL(10,2) / DATETIME" />
            </Form.Item>
            <Form.Item name="nullable" label="可空" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Checkbox>允许 NULL</Checkbox>
            </Form.Item>
            <Form.Item name="defaultValue" label="默认值" style={{ marginBottom: 12 }}>
              <Input aria-label="默认值" placeholder="留空则不设默认；可填 NULL / CURRENT_TIMESTAMP / 0 / 文本" />
            </Form.Item>
            <Form.Item name="comment" label="注释" style={{ marginBottom: 12 }}>
              <Input aria-label="注释" />
            </Form.Item>
            {alter?.action === 'add' && (
              <Form.Item name="after" label="位置" style={{ marginBottom: 0 }}>
                <Select
                  allowClear
                  placeholder="追加到末尾"
                  aria-label="位置"
                  options={cols.map((c) => ({ value: c.name, label: `在 ${c.name} 之后` }))}
                />
              </Form.Item>
            )}
          </>
        )}
      </FormModal>

      <FormModal<{ comment: string }>
        open={commentOpen}
        title="修改表说明"
        initialValues={{ comment: currentComment }}
        confirmLoading={commentMutation.isPending}
        onSubmit={(v) => commentMutation.mutate(v.comment ?? '')}
        onClose={() => setCommentOpen(false)}
        okText="保存"
        width={480}
      >
        <Form.Item name="comment" label="表说明" style={{ marginBottom: 0 }}>
          <Input.TextArea
            aria-label="表说明"
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={2048}
            showCount
            placeholder="这张表存什么，一句话说明；留空即清除说明"
          />
        </Form.Item>
      </FormModal>
    </Space>
  );
}

// =====================================================================
// SQL 查询：全放开（读 + 写 + DDL），写 / DDL 前端二次确认
// =====================================================================

function SqlConsole({ userId }: { userId: number }) {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<DbSqlResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runMutation = useApiMutation(
    (statement: string) => runDbSql(statement, withIdentity(String(userId))),
    {
      onSettledSuccess: (r) => {
        setResult(r);
        setConfirmOpen(false);
      },
    },
  );

  const onRun = () => {
    const statement = sql.trim();
    if (!statement) return;
    if (isReadOnlySql(statement)) {
      runMutation.mutate(statement);
    } else {
      setConfirmOpen(true);
    }
  };

  const resultColumns: TableColumnsType<DbRow> = (result?.columns ?? []).map((c) => ({
    title: c.name,
    dataIndex: c.name,
    key: c.name,
    ellipsis: true,
    render: (v: DbRow[string]) => <CellValue value={v} />,
  }));

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Input.TextArea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="SQL 语句"
        placeholder="输入一条 SQL，如 SELECT * FROM app_user LIMIT 20"
        style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 13, lineHeight: 1.6, minHeight: 120 }}
      />
      <Space size={8} wrap>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={runMutation.isPending}
          disabled={!sql.trim()}
          onClick={onRun}
        >
          执行
        </Button>
        {!isReadOnlySql(sql) && sql.trim() && <Tag color="orange">写 / DDL · 执行前会二次确认</Tag>}
        {result?.type === 'resultSet' && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            返回 {result.rowCount} 行{result.truncated ? '（已截断，仅显示前 1000 行）' : ''}
          </Typography.Text>
        )}
      </Space>

      {result?.type === 'update' && (
        <Alert type="success" showIcon message={`执行成功，影响 ${result.updateCount} 行`} />
      )}
      {result?.type === 'resultSet' && (
        <Table
          size="small"
          rowKey={(_r, i) => String(i)}
          columns={resultColumns}
          dataSource={result.rows ?? []}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: PAGE_SIZE, showSizeChanger: false }}
        />
      )}

      <Modal
        open={confirmOpen}
        title="确认执行"
        okText="确认执行"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={runMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onOk={() => runMutation.mutate(sql.trim())}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert type="warning" showIcon message="这是一条写 / DDL 语句，会直接改动数据库，执行前请核对。" />
          <pre
            style={{
              margin: 0,
              padding: '8px 12px',
              background: '#f5f5f5',
              borderRadius: 6,
              fontFamily: 'Menlo, Consolas, monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {sql.trim()}
          </pre>
        </Space>
      </Modal>
    </Space>
  );
}

// =====================================================================
// 备份：立即备份 + 保留天数 + 备份列表
// =====================================================================

function BackupPanel({ userId }: { userId: number }) {
  const backupsQuery = useQuery({
    queryKey: ['db-backups', userId],
    queryFn: ({ signal }) => fetchDbBackups({ ...withIdentity(String(userId)), signal }),
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  const info = backupsQuery.data;
  const available = info?.available ?? false;
  const savedDays = info?.retentionDays ?? null;
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    if (savedDays != null) setDays(savedDays);
  }, [savedDays]);

  const backupMutation = useApiMutation(() => backupDbNow(withIdentity(String(userId))), {
    invalidate: [['db-backups', userId]],
    successMessage: '备份完成',
  });

  const retentionMutation = useApiMutation(
    (value: number) => saveDbSettings(value, withIdentity(String(userId))),
    { invalidate: [['db-backups', userId]], successMessage: '已保存' },
  );

  const deleteMutation = useApiMutation(
    (name: string) => deleteDbBackup(name, withIdentity(String(userId))),
    { invalidate: [['db-backups', userId]], successMessage: '已删除' },
  );

  const backupColumns: TableColumnsType<{ name: string; size: number; lastModified: number }> = [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    { title: '大小', dataIndex: 'size', key: 'size', width: 120, render: (v: number) => formatBytes(v) },
    { title: '备份时间', dataIndex: 'lastModified', key: 'lastModified', width: 200, render: (v: number) => formatTime(v) },
    {
      title: '操作',
      key: '__op',
      width: 100,
      render: (_: unknown, r) => (
        <Popconfirm
          title="删除这个备份文件？"
          okText="删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onConfirm={() => deleteMutation.mutate(r.name)}
        >
          <Button size="small" type="link" danger icon={<DeleteOutlined />}>
            删
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const controls = (
    <Space size={8} wrap>
      <Typography.Text type="secondary">保留天数</Typography.Text>
      <Tooltip title="超过该天数的历史备份会被自动清理，默认 7 天；每日 04:00 自动备份一次，修改后立即生效并清理旧备份。">
        <QuestionCircleOutlined aria-label="备份保留天数口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <InputNumber
        style={{ width: 110 }}
        min={RETENTION_MIN}
        max={RETENTION_MAX}
        precision={0}
        value={days}
        onChange={(v) => setDays(typeof v === 'number' ? v : null)}
        disabled={!available}
        addonAfter="天"
        aria-label="备份保留天数"
      />
      <Button
        type="primary"
        loading={retentionMutation.isPending}
        disabled={!available || days == null || days === savedDays}
        onClick={() => days != null && retentionMutation.mutate(days)}
      >
        保存
      </Button>
      <Button
        icon={<CloudDownloadOutlined />}
        loading={backupMutation.isPending}
        disabled={!available}
        onClick={() => backupMutation.mutate(undefined)}
      >
        立即备份
      </Button>
      {available && info?.backupDir && (
        <Tooltip title={info.backupDir}>
          <Typography.Text type="secondary" style={{ fontSize: 12, cursor: 'help' }}>
            备份目录
          </Typography.Text>
        </Tooltip>
      )}
    </Space>
  );

  let body: ReactNode;
  if (backupsQuery.isLoading) {
    body = (
      <Space size={8}>
        <Spin aria-label="正在读取备份列表" />
        <Typography.Text type="secondary">正在读取备份列表…</Typography.Text>
      </Space>
    );
  } else if (backupsQuery.isError) {
    body = <Alert type="error" showIcon message="读取备份列表失败" description={backupsQuery.error.message} />;
  } else if (!available) {
    body = (
      <Empty description="当前运行环境未落日志文件，无法确定备份目录，备份不可用。">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          部署机以 prod 运行（注入 LOGGING_FILE_NAME）后，备份会落到与 logs 同级的 backups 目录，这里即可管理。
        </Typography.Text>
      </Empty>
    );
  } else {
    body = (
      <Table
        size="small"
        rowKey="name"
        loading={backupsQuery.isFetching}
        columns={backupColumns}
        dataSource={info?.backups ?? []}
        pagination={{ pageSize: PAGE_SIZE, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="还没有备份，点「立即备份」生成第一个" /> }}
      />
    );
  }

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {controls}
      {body}
    </Space>
  );
}
