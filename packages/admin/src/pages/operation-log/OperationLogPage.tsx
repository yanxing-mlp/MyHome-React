import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Result,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { can, PERMISSION, ROLE_LABEL, useCurrentUser } from '@family-home/shared/auth';
import {
  OP_RETENTION_DAYS_MAX,
  OP_RETENTION_DAYS_MIN,
  fetchOperationLogRetention,
  fetchOperationLogs,
  updateOperationLogRetention,
} from '../../api/operationLog';
import type { OperationLog } from '../../api/operationLog';
import { useUserOptions } from '../../features/user/useUsers';
import { PageShell } from '../../components/PageShell';
import { TimeText } from '../../components/TimeText';
import { useApiMutation } from '../../hooks/useApiMutation';
import { withIdentity } from '../../lib/http';

const { Search } = Input;
const { RangePicker } = DatePicker;

/** 来源筛选：全部 / B 端 / C 端。清空即全部，与其余下拉同一口径。 */
const SOURCE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'B', label: 'B 端' },
  { value: 'C', label: 'C 端' },
];

const STATUS_OPTIONS = [
  { value: -1, label: '全部' },
  { value: 1, label: '成功' },
  { value: 0, label: '失败' },
];

const METHOD_COLOR: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  DELETE: 'red',
};

/** 先隔离权限再挂载数据组件：普通成员不会创建任何审计查询（与系统日志/部署管理页同一口径）。 */
export function OperationLogPage() {
  const user = useCurrentUser();
  if (!user || !can(user, PERMISSION.OPLOG_ACCESS)) return <Result status="403" title="只有超级管理员能查看操作记录" />;
  return <OperationLogContent key={user.id} userId={user.id} />;
}

function OperationLogContent({ userId }: { userId: number }) {
  const navigate = useNavigate();
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [source, setSource] = useState('');
  const [filterUserId, setFilterUserId] = useState<number>();
  const [success, setSuccess] = useState(-1);
  const [keyword, setKeyword] = useState<string>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [days, setDays] = useState<number | null>(null);

  const { data: userOptions } = useUserOptions();

  const startTime = range?.[0] ? range[0].startOf('day').valueOf() : undefined;
  const endTime = range?.[1] ? range[1].endOf('day').valueOf() : undefined;

  const listQuery = useQuery({
    queryKey: ['operation-logs', userId, pageNo, pageSize, source, filterUserId, success, keyword, startTime, endTime],
    queryFn: ({ signal }) =>
      fetchOperationLogs(
        {
          pageNo,
          pageSize,
          source: source || undefined,
          userId: filterUserId,
          success: success === -1 ? undefined : success,
          keyword,
          startTime,
          endTime,
        },
        { ...withIdentity(String(userId)), signal },
      ),
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const retentionQuery = useQuery({
    queryKey: ['operation-log-retention', userId],
    queryFn: ({ signal }) => fetchOperationLogRetention({ ...withIdentity(String(userId)), signal }),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  const retentionMutation = useApiMutation(
    (value: number) => updateOperationLogRetention(value, withIdentity(String(userId))),
    { invalidate: [['operation-log-retention', userId]], successMessage: '已保存' },
  );

  const savedDays = retentionQuery.data?.retentionDays ?? null;
  // 后端值到达（或保存后被 invalidate 重取）时回填编辑框；用 savedDays 兜初值，避免闪空。
  const daysValue = days ?? savedDays;

  const resetPage = () => setPageNo(1);

  const columns: ColumnsType<OperationLog> = [
    {
      title: '时间',
      dataIndex: 'createTime',
      width: 170,
      render: (time: string) => <TimeText value={time} />,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 70,
      render: (s: string) => <Tag color={s === 'B' ? 'geekblue' : 'cyan'}>{s === 'B' ? 'B 端' : s === 'C' ? 'C 端' : s}</Tag>,
    },
    {
      title: '操作人',
      dataIndex: 'userName',
      width: 110,
      render: (name: string | null, row) =>
        name ? (
          <span>
            {name}
            {row.userRole && row.userRole !== 'MEMBER' && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                （{ROLE_LABEL[row.userRole] ?? row.userRole}）
              </Typography.Text>
            )}
          </span>
        ) : (
          <Typography.Text type="secondary">匿名</Typography.Text>
        ),
    },
    { title: '页面', dataIndex: 'page', width: 140, render: (p: string | null) => p || <Typography.Text type="secondary">—</Typography.Text> },
    { title: '操作', dataIndex: 'action', width: 160 },
    {
      title: '方法',
      dataIndex: 'httpMethod',
      width: 80,
      render: (m: string) => <Tag color={METHOD_COLOR[m] ?? 'default'}>{m}</Tag>,
    },
    {
      title: '结果',
      dataIndex: 'success',
      width: 80,
      render: (ok: number, row) =>
        ok === 1 ? (
          <Tag color="success">成功</Tag>
        ) : (
          <Tooltip title={row.errorCode ?? undefined}>
            <Tag color="error">失败</Tag>
          </Tooltip>
        ),
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      width: 80,
      render: (ms: number) => <Typography.Text type="secondary">{ms} ms</Typography.Text>,
    },
  ];

  const actions = (
    <Space size={8}>
      <Typography.Text type="secondary">保留天数</Typography.Text>
      <Tooltip title="超过该天数的操作记录会被每日定时清理，默认 7 天；修改后下次清理即按新天数生效。">
        <QuestionCircleOutlined aria-label="操作记录保留天数口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <InputNumber
        style={{ width: 110 }}
        min={OP_RETENTION_DAYS_MIN}
        max={OP_RETENTION_DAYS_MAX}
        precision={0}
        value={daysValue}
        onChange={(value) => setDays(typeof value === 'number' ? value : null)}
        addonAfter="天"
        aria-label="操作记录保留天数"
      />
      <Button
        type="primary"
        loading={retentionMutation.isPending}
        disabled={days == null || days === savedDays}
        onClick={() => days != null && retentionMutation.mutate(days)}
      >
        保存
      </Button>
    </Space>
  );

  const toolbar = (
    <Space wrap size={8}>
      <Segmented
        options={SOURCE_OPTIONS}
        value={source}
        onChange={(value) => {
          setSource(value as string);
          resetPage();
        }}
      />
      <Select
        placeholder="操作人"
        allowClear
        style={{ width: 140 }}
        options={(userOptions ?? []).map((u) => ({ value: u.id, label: u.name }))}
        value={filterUserId}
        onChange={(value?: number) => {
          setFilterUserId(value);
          resetPage();
        }}
      />
      <Select
        placeholder="结果"
        style={{ width: 100 }}
        options={STATUS_OPTIONS}
        value={success}
        onChange={(value: number) => {
          setSuccess(value);
          resetPage();
        }}
      />
      <RangePicker
        value={range as never}
        onChange={(value) => {
          setRange(value as [Dayjs | null, Dayjs | null] | null);
          resetPage();
        }}
      />
      <Search
        placeholder="搜索操作 / 页面 / 操作人 / 接口"
        allowClear
        style={{ width: 260 }}
        onSearch={(value) => {
          setKeyword(value || undefined);
          resetPage();
        }}
      />
      <Tooltip title="读写全记：每一次业务请求（含查看类 GET）都会留一条，区分 B 端（管理端）与 C 端（家庭端）。展开一行可看接口路径、来源 IP、脱敏后的入参与响应摘要。「在哪个页面」由前端随请求带上，「做了什么」由后端动作字典翻成中文。心跳、审计页自身与日志/部署进度轮询不记录。">
        <QuestionCircleOutlined aria-label="操作记录口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
    </Space>
  );

  return (
    <PageShell title="操作记录" actions={actions} toolbar={toolbar}>
      <Card variant="borderless">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.list ?? []}
          loading={listQuery.isFetching}
          size="small"
          expandable={{
            expandedRowRender: (row) => (
              <Space orientation="vertical" size={6} style={{ display: 'flex' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  接口：{row.httpMethod} {row.uri}
                  {row.clientIp ? `　来源 IP：${row.clientIp}` : ''}
                  {row.errorCode ? `　错误码：${row.errorCode}` : ''}
                </Typography.Text>
                {row.traceId ? (
                  <Space size={6}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      traceId：
                    </Typography.Text>
                    <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>
                      {row.traceId}
                    </Typography.Text>
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, height: 'auto', fontSize: 12 }}
                      onClick={() => navigate(`/logs?traceId=${encodeURIComponent(row.traceId!)}`)}
                    >
                      查看关联日志
                    </Button>
                  </Space>
                ) : null}
                <div>
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    入参
                  </Typography.Text>
                  <pre style={preStyle}>{pretty(row.requestParams)}</pre>
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    响应摘要
                  </Typography.Text>
                  <pre style={preStyle}>{pretty(row.responseSummary)}</pre>
                </div>
              </Space>
            ),
          }}
          pagination={{
            current: pageNo,
            pageSize,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
              setPageNo(page);
              setPageSize(size);
            },
          }}
          locale={{ emptyText: '没有符合条件的操作记录' }}
        />
      </Card>
    </PageShell>
  );
}

const preStyle: React.CSSProperties = {
  margin: '2px 0 0',
  padding: '6px 10px',
  background: '#f6f6f6',
  borderRadius: 4,
  fontFamily: 'Menlo, Consolas, monospace',
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 240,
  overflow: 'auto',
};

/** 入参/响应是后端落库的 JSON 文本，能解析就美化缩进，解析不了原样显示。 */
function pretty(raw?: string | null): string {
  if (!raw) return '（无）';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
