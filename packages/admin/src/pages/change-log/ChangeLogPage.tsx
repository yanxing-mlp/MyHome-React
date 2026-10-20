import { useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Empty, Input, Result, Space, Spin, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { TableProps } from 'antd';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useCurrentUser } from '@family-home/shared/auth';
import { fetchChangeLog } from '../../api/changeLog';
import type { ChangeLogCommit, ChangeLogRepository, ChangeLogSource, ChangeLogTopSource } from '../../api/changeLog';
import { PageShell } from '../../components/PageShell';
import { ResponsiveList } from '../../components/ResponsiveList';
import { TimeText } from '../../components/TimeText';
import { withIdentity } from '../../lib/http';

const { RangePicker } = DatePicker;
const { Search } = Input;

const WRAP_STYLE = { overflowWrap: 'anywhere', whiteSpace: 'normal', minWidth: 0 } as const;

/** 每仓客户端分页的固定页长（ResponsiveList 的分页器不开 sizeChanger）。 */
const PAGE_SIZE = 10;

/** 单仓来源徽标：实时=绿、快照兜底=橙、不可用=红。 */
const REPO_SOURCE_TAG: Record<ChangeLogSource, { color: string; text: string }> = {
  live: { color: 'green', text: '实时' },
  snapshot: { color: 'orange', text: '快照兜底' },
  unavailable: { color: 'red', text: '不可用' },
};

/** 顶层来源徽标：全实时/全快照沿用单仓配色，部分实时用蓝色区分。 */
const TOP_SOURCE_TAG: Record<ChangeLogTopSource, { color: string; text: string }> = {
  ...REPO_SOURCE_TAG,
  mixed: { color: 'blue', text: '部分实时' },
};

/** Tab 上只显示短名（后端/前端），完整仓库名留在卡片头里。 */
const REPO_TAB_LABEL: Record<string, string> = { server: '后端', web: '前端' };

function repoTabLabel(repo: ChangeLogRepository): string {
  return REPO_TAB_LABEL[repo.key] ?? repo.label.split('·')[0]?.trim() ?? repo.key;
}

type DateRange = [Dayjs | null, Dayjs | null] | null;

/** 客户端过滤：commitId 打在完整/短 hash 上（子串、忽略大小写），时间按自然日闭区间。 */
function filterCommits(commits: ChangeLogCommit[], commitId: string | undefined, range: DateRange): ChangeLogCommit[] {
  const q = commitId?.trim().toLowerCase();
  const start = range?.[0]?.startOf('day');
  const end = range?.[1]?.endOf('day');
  return commits.filter((commit) => {
    if (q && !commit.hash.toLowerCase().includes(q) && !commit.shortHash.toLowerCase().includes(q)) {
      return false;
    }
    if (start || end) {
      const at = dayjs(commit.date);
      if (!at.isValid()) return false;
      if (start && at.isBefore(start)) return false;
      if (end && at.isAfter(end)) return false;
    }
    return true;
  });
}

/** 当前运行版本标记：金色，和来源徽标（绿/橙/红/蓝）区分开。 */
const RUNNING_TAG_COLOR = 'gold';

/** 运行版本的短 hash（列表里没有对应行时，头部标记靠它兜底展示）。 */
function shortOf(hash: string): string {
  return hash.length >= 7 ? hash.slice(0, 7) : hash;
}

/** 列定义随「当前运行 commit」变化：命中的那一行在提交号后挂一个「运行中」标记。 */
function buildColumns(runningCommit?: string): NonNullable<TableProps<ChangeLogCommit>['columns']> {
  return [
    {
      title: '提交',
      dataIndex: 'shortHash',
      width: 180,
      render: (_, commit) => (
        <Space size={6}>
          <Typography.Text code copyable={{ text: commit.hash }}>
            {commit.shortHash}
          </Typography.Text>
          {runningCommit && commit.hash === runningCommit && <Tag color={RUNNING_TAG_COLOR}>运行中</Tag>}
        </Space>
      ),
    },
    { title: '说明', dataIndex: 'message', render: (message: string) => <div style={{ maxWidth: 560, ...WRAP_STYLE }}>{message}</div> },
    { title: '作者', dataIndex: 'author', width: 120, render: (author: string) => <div style={WRAP_STYLE}>{author}</div> },
    { title: '提交时间', dataIndex: 'date', width: 180, render: (date: string) => <TimeText value={date} /> },
  ];
}

function RepoHeader({ repo, shownCount }: { repo: ChangeLogRepository; shownCount: number }) {
  const sourceTag = repo.source ? REPO_SOURCE_TAG[repo.source] : undefined;
  // 过滤生效时显示「命中 / 全量」，否则只显示全量，让用户一眼看出当前是不是被筛过。
  const countText = shownCount === repo.commitCount ? `${repo.commitCount} 条提交` : `${shownCount} / ${repo.commitCount} 条`;
  return (
    <Space wrap size={8}>
      <Typography.Text strong>{repo.label}</Typography.Text>
      <Tag color="blue">{repo.branch}</Tag>
      <Tag>{countText}</Tag>
      {sourceTag && <Tag color={sourceTag.color}>{sourceTag.text}</Tag>}
      {repo.runningCommit && (
        <Tooltip title="当前系统运行的是这个提交（打包时的版本）。列表里比它更新的提交尚未部署。">
          <Tag color={RUNNING_TAG_COLOR}>当前运行 · {shortOf(repo.runningCommit)}</Tag>
        </Tooltip>
      )}
    </Space>
  );
}

function RepoSection({ repo, commitId, range }: { repo: ChangeLogRepository; commitId?: string; range: DateRange }) {
  const [pageNo, setPageNo] = useState(1);
  const columns = useMemo(() => buildColumns(repo.runningCommit), [repo.runningCommit]);
  const filtered = useMemo(() => filterCommits(repo.commits, commitId, range), [repo.commits, commitId, range]);
  const pageItems = useMemo(
    () => filtered.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE),
    [filtered, pageNo],
  );
  const filtering = Boolean(commitId?.trim()) || Boolean(range?.[0] || range?.[1]);

  return (
    <Card size="small" title={<RepoHeader repo={repo} shownCount={filtered.length} />}>
      {repo.commits.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该分支暂无提交" />
      ) : (
        <ResponsiveList<ChangeLogCommit>
          items={pageItems}
          keyOf={(commit) => commit.hash}
          columns={columns}
          emptyText={filtering ? '没有符合条件的提交' : '该分支暂无提交'}
          pagination={{
            current: pageNo,
            pageSize: PAGE_SIZE,
            total: filtered.length,
            onChange: (page) => setPageNo(page),
          }}
          renderCard={(commit) => (
            <Space orientation="vertical" size={6} style={{ width: '100%', ...WRAP_STYLE }}>
              <Space wrap size={8}>
                <Typography.Text code copyable={{ text: commit.hash }}>
                  {commit.shortHash}
                </Typography.Text>
                {repo.runningCommit && commit.hash === repo.runningCommit && <Tag color={RUNNING_TAG_COLOR}>运行中</Tag>}
                <TimeText value={commit.date} />
              </Space>
              <div style={WRAP_STYLE}>{commit.message}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{commit.author}</Typography.Text>
            </Space>
          )}
        />
      )}
    </Card>
  );
}

/** 先隔离权限再挂载数据组件，普通成员不会创建任何变更记录查询。 */
export function ChangeLogPage() {
  const user = useCurrentUser();
  if (user?.role !== 'ADMIN') return <Result status="403" title="只有管理员能查看变更记录" />;
  return <AdminChangeLogContent key={user.id} userId={user.id} />;
}

function AdminChangeLogContent({ userId }: { userId: number }) {
  const [commitId, setCommitId] = useState<string>();
  const [range, setRange] = useState<DateRange>(null);

  const query = useQuery({
    queryKey: ['change-log', userId],
    queryFn: ({ signal }) => fetchChangeLog({ ...withIdentity(String(userId)), signal }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 失败时不展示上一份数据；提交历史要么是这份实时/快照结果、要么没有。
  const changeLog = query.isError ? undefined : query.data;
  const topSource = changeLog?.source ? TOP_SOURCE_TAG[changeLog.source] : undefined;
  // 快照兜底时 generatedAt 是构建期时间，其余情况是本次组装时间，标签随之区分。
  const timeLabel = changeLog?.source === 'snapshot' ? '快照生成于' : '更新于';
  const hasData = !query.isError && !!changeLog && changeLog.repositories.length > 0;
  // 过滤条件变化时用它当 RepoSection 的 key 强制重挂，把每仓的 pageNo 复位到第 1 页。
  const filterSig = `${commitId ?? ''}|${range?.[0]?.valueOf() ?? ''}|${range?.[1]?.valueOf() ?? ''}`;

  return (
    <PageShell
      title="变更记录"
      actions={
        <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>
          刷新
        </Button>
      }
      toolbar={
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Space wrap size={8}>
            {topSource && <Tag color={topSource.color}>{topSource.text}</Tag>}
            {changeLog?.generatedAt && <TimeText value={changeLog.generatedAt} label={timeLabel} />}
            <Tooltip title="前后端两仓当前分支的全部提交，用下方「后端 / 前端」标签页切换查看。默认实时从 GitHub 拉取（断网或触发限流时自动回退到打包时烘进后端的快照，每仓各自独立判断）；顶部可按时间范围、commit ID 过滤，过滤对两个标签页同时生效，每仓各自分页。">
              <QuestionCircleOutlined aria-label="变更记录口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
            </Tooltip>
          </Space>
          {hasData && (
            <Space wrap size={8}>
              <RangePicker
                allowClear
                value={range ?? undefined}
                onChange={(value) => setRange((value as DateRange) ?? null)}
                placeholder={['提交起始日', '提交结束日']}
              />
              <Search
                allowClear
                placeholder="按 commit ID 过滤"
                onSearch={(value) => setCommitId(value || undefined)}
                style={{ width: 240 }}
              />
            </Space>
          )}
        </Space>
      }
    >
      {query.isError ? (
        <Alert type="error" showIcon title="变更记录读取失败" description={query.error.message} />
      ) : !changeLog ? (
        <Spin aria-label="正在读取变更记录" />
      ) : changeLog.repositories.length === 0 ? (
        <Empty description="暂无变更记录" />
      ) : (
        <Tabs
          items={changeLog.repositories.map((repo) => ({
            key: repo.key,
            label: repoTabLabel(repo),
            children: <RepoSection key={`${repo.key}-${filterSig}`} repo={repo} commitId={commitId} range={range} />,
          }))}
        />
      )}
    </PageShell>
  );
}
