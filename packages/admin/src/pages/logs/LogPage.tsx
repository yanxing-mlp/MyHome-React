import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Empty, Input, InputNumber, Result, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined, ReloadOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';
import {
  RETENTION_DAYS_MAX,
  RETENTION_DAYS_MIN,
  fetchLogFiles,
  fetchLogRetention,
  fetchLogTail,
  updateLogRetention,
} from '../../api/logs';
import type { LogFileMeta } from '../../api/logs';
import { PageShell } from '../../components/PageShell';
import { useApiMutation } from '../../hooks/useApiMutation';
import { withIdentity } from '../../lib/http';

/** 前端自己保留的行数上限（环形）：后端只按字节封顶，行数交给这里兜，避免长时间挂着把浏览器撑爆。 */
const MAX_RETAIN = 5000;
/** 轮询间隔，与部署进度同一口径（全仓无 SSE/WebSocket，"实时"= 定时增量拉）。 */
const POLL_MS = 1500;
/** 文件列表慢轮询：让部署脚本新写出的日志文件能自动出现在下拉里。 */
const FILES_POLL_MS = 20000;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 先隔离权限再挂载数据组件：普通成员不会创建任何日志查询（与部署管理页同一口径）。 */
export function LogPage() {
  const user = useCurrentUser();
  if (!user || !can(user, PERMISSION.LOGS_ACCESS)) return <Result status="403" title="只有超级管理员能查看系统日志" />;
  return <LogContent key={user.id} userId={user.id} />;
}

function LogContent({ userId }: { userId: number }) {
  // traceId 过滤：v46 对 v43「极简、无过滤器」口径开的定向例外——只此一个过滤器，
  // 由操作记录页「查看关联日志」深链带入（?traceId=），也可手动输入。纯前端视图过滤，
  // 只作用于当前文件已读进内存的那段行（tail/offset 增量逻辑不动）。
  const [searchParams, setSearchParams] = useSearchParams();
  const [traceFilter, setTraceFilter] = useState(() => searchParams.get('traceId') ?? '');
  const [file, setFile] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [follow, setFollow] = useState(true);
  const [connError, setConnError] = useState(false);
  // 增量游标用 ref：轮询闭包里要读到最新值，又不想因为它变化而重挂 interval。
  const offsetRef = useRef<number>(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  // 保留天数的可编辑值：从后端读到后回填，未改动时「保存」置灰。
  const [days, setDays] = useState<number | null>(null);

  const filesQuery = useQuery({
    queryKey: ['log-files', userId],
    queryFn: ({ signal }) => fetchLogFiles({ ...withIdentity(String(userId)), signal }),
    refetchInterval: FILES_POLL_MS,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 0,
    gcTime: 0,
  });

  // 日志保留天数：与文件列表分开一份查询，改一次才 invalidate 一次，不随 tail 轮询刷新。
  const retentionQuery = useQuery({
    queryKey: ['log-retention', userId],
    queryFn: ({ signal }) => fetchLogRetention({ ...withIdentity(String(userId)), signal }),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  const retentionMutation = useApiMutation(
    (value: number) => updateLogRetention(value, withIdentity(String(userId))),
    { invalidate: [['log-retention', userId]], successMessage: '已保存' },
  );

  const available = retentionQuery.data?.available ?? false;
  const savedDays = retentionQuery.data?.retentionDays ?? null;

  // 后端值到达（或保存后被 invalidate 重取）时回填编辑框。
  useEffect(() => {
    if (savedDays != null) setDays(savedDays);
  }, [savedDays]);

  const files: LogFileMeta[] = filesQuery.data ?? [];

  // 首次拿到列表时自动选中最近在写的那个（列表已按 mtime 倒序）。
  useEffect(() => {
    if (file === null && files.length > 0) {
      offsetRef.current = -1;
      setFile(files[0].name);
    }
  }, [files, file]);

  // 选中文件后开始增量轮询 tail；切文件时重挂（依赖里带 file），offsetRef 已在切换处复位为 -1。
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetchLogTail(file, offsetRef.current, withIdentity(String(userId)));
        if (cancelled) return;
        offsetRef.current = res.offset;
        setConnError(false);
        if (res.rotated) {
          // 初次打开或文件被轮转/截断：整屏用本轮内容重建。
          setLines(res.lines.slice(-MAX_RETAIN));
        } else if (res.lines.length > 0) {
          setLines((prev) => {
            const next = prev.concat(res.lines);
            return next.length > MAX_RETAIN ? next.slice(next.length - MAX_RETAIN) : next;
          });
        }
      } catch {
        // 后端重启/网络抖动的空窗：保留已显示的行，标记重连，下一轮自动接上。
        if (!cancelled) setConnError(true);
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [file, userId]);

  // 视图层过滤：带 traceFilter 时只保留包含该串的行，否则原样。不碰 lines 本身，
  // 清空过滤即恢复全部（含过滤期间新到达的行）。
  const visibleLines = useMemo(() => {
    const key = traceFilter.trim();
    return key ? lines.filter((line) => line.includes(key)) : lines;
  }, [lines, traceFilter]);

  // 跟随最新：新行到来或用户点「跟随最新」时滚到底。
  useEffect(() => {
    const el = boxRef.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [visibleLines, follow]);

  const onSwitchFile = (name: string) => {
    offsetRef.current = -1;
    setLines([]);
    setConnError(false);
    setFollow(true);
    setFile(name);
  };

  const scrollToBottom = () => {
    setFollow(true);
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // 用户往上滚就暂停跟随，滚回底部附近再自动恢复。
  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setFollow(distanceToBottom < 40);
  };

  const options = useMemo(
    () => files.map((f) => ({ value: f.name, label: `${f.name} · ${formatBytes(f.size)}` })),
    [files],
  );

  // 手动改过滤词时同步进 URL，深链可分享/刷新不丢；清空则摘掉 traceId 参数。
  const onTraceFilterChange = (value: string) => {
    setTraceFilter(value);
    const next = new URLSearchParams(searchParams);
    const key = value.trim();
    if (key) next.set('traceId', key);
    else next.delete('traceId');
    setSearchParams(next, { replace: true });
  };

  const actions = (
    <Space size={8}>
      <Typography.Text type="secondary">保留天数</Typography.Text>
      <Tooltip title="超过该天数的历史日志归档会被自动清理，默认 7 天；修改后立即生效。开发机日志只打控制台、未落文件，此项不可配置。">
        <QuestionCircleOutlined aria-label="日志保留天数口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
      <InputNumber
        style={{ width: 110 }}
        min={RETENTION_DAYS_MIN}
        max={RETENTION_DAYS_MAX}
        precision={0}
        value={days}
        onChange={(value) => setDays(typeof value === 'number' ? value : null)}
        disabled={!available}
        addonAfter="天"
        aria-label="日志保留天数"
      />
      <Button
        type="primary"
        loading={retentionMutation.isPending}
        disabled={!available || days == null || days === savedDays}
        onClick={() => days != null && retentionMutation.mutate(days)}
      >
        保存
      </Button>
      <Button icon={<ReloadOutlined />} loading={filesQuery.isFetching} onClick={() => void filesQuery.refetch()}>
        刷新文件
      </Button>
    </Space>
  );

  const toolbar = (
    <Space wrap size={8}>
      <Select
        style={{ minWidth: 260 }}
        placeholder="选择日志文件"
        value={file ?? undefined}
        options={options}
        onChange={onSwitchFile}
        disabled={files.length === 0}
        notFoundContent={filesQuery.isFetching ? <Spin size="small" /> : '无日志文件'}
      />
      <Input
        style={{ width: 220 }}
        allowClear
        placeholder="按 traceId 过滤关联日志"
        value={traceFilter}
        onChange={(e) => onTraceFilterChange(e.target.value)}
        aria-label="按 traceId 过滤日志"
      />
      {traceFilter.trim() && (
        <Tag color="blue">
          匹配 {visibleLines.length} / {lines.length} 行
        </Tag>
      )}
      {!follow && file && (
        <Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={scrollToBottom}>
          跟随最新
        </Button>
      )}
      {connError && <Tag color="orange">连接中断，正在重试…</Tag>}
      <Tooltip title="这里只读地实时查看后端日志目录下的 *.log 文件（后端自身日志与部署脚本写出的日志）。切换文件即从末尾开始增量跟随，约 1.5 秒拉一次新行；日志文件被轮转时会自动重读末尾。开发机日志只打到控制台、未落文件，此页会显示为空。traceId 过滤只在当前文件已读入的这段日志里做匹配（一次请求的日志与操作记录里的 traceId 同值）。">
        <QuestionCircleOutlined aria-label="系统日志口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
      </Tooltip>
    </Space>
  );

  let body: ReactNode;
  if (filesQuery.isLoading) {
    body = (
      <Space size={8}>
        <Spin aria-label="正在读取日志文件列表" />
        <Typography.Text type="secondary">正在读取日志文件列表…</Typography.Text>
      </Space>
    );
  } else if (filesQuery.isError) {
    body = <Alert type="error" showIcon message="日志文件列表读取失败" description={filesQuery.error.message} />;
  } else if (files.length === 0) {
    body = (
      <Empty description="当前环境未落日志文件（开发机为控制台输出），无法在此查看。">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          部署机以 prod 运行时，后端与部署脚本的日志会写进 logs 目录，这里即可实时查看。
        </Typography.Text>
      </Empty>
    );
  } else if (lines.length === 0) {
    body = (
      <Space size={8}>
        <Spin aria-label="正在读取日志" />
        <Typography.Text type="secondary">正在读取「{file}」…</Typography.Text>
      </Space>
    );
  } else if (visibleLines.length === 0) {
    body = (
      <Empty description={`当前文件的这段日志里没有包含「${traceFilter.trim()}」的行`}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          过滤只作用于已读入内存的日志（最近一段 + 之后新增）。目标请求若更早、或在别的日志文件里，请切换文件或清空过滤。
        </Typography.Text>
      </Empty>
    );
  } else {
    body = (
      <div
        ref={boxRef}
        onScroll={onScroll}
        style={{
          height: 'calc(100vh - 260px)',
          minHeight: 360,
          overflowY: 'auto',
          background: '#1e1e1e',
          color: '#d4d4d4',
          borderRadius: 6,
          padding: '8px 12px',
        }}
      >
        <pre style={{ margin: 0, fontFamily: 'Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {visibleLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      </div>
    );
  }

  return (
    <PageShell title="系统日志" actions={actions} toolbar={toolbar}>
      {body}
    </PageShell>
  );
}
