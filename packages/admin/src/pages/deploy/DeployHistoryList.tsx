import { useMemo } from 'react';
import { Alert, Collapse, Empty, Space, Spin, Tag, Timeline, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchDeployHistory } from '../../api/deploy';
import type { DeployHistoryEntry } from '../../api/deploy';
import { TimeText } from '../../components/TimeText';
import { withIdentity } from '../../lib/http';
import { DEPLOY_STATUS_TAG, commitMigration, formatDuration, versionMigration } from './statusMeta';

const WRAP_STYLE = { overflowWrap: 'anywhere', whiteSpace: 'normal', minWidth: 0 } as const;

/** 一条历史展开后的完整日志（复用实时进度那套 Timeline 渲染口径）。 */
function HistoryLog({ entry }: { entry: DeployHistoryEntry }) {
  const timelineItems = useMemo(
    () =>
      (entry.lines ?? []).map((line, index) => ({
        key: index,
        color: line.level === 'error' ? 'red' : 'blue',
        children: (
          <Space size={8} style={{ alignItems: 'baseline' }}>
            <TimeText value={line.ts} />
            <Typography.Text type={line.level === 'error' ? 'danger' : undefined}>{line.message}</Typography.Text>
          </Space>
        ),
      })),
    [entry.lines],
  );
  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {entry.status === 'failed' && entry.error && (
        <Alert type="error" showIcon message="部署失败" description={entry.error} />
      )}
      {timelineItems.length === 0 ? (
        <Typography.Text type="secondary">这次部署没有留下进度日志。</Typography.Text>
      ) : (
        <Timeline items={timelineItems} />
      )}
    </Space>
  );
}

/** 折叠面板头：状态徽标 + 开始时间 + 耗时 + 版本迁移（优先产物版本戳，退回两仓 commit），失败时把错误摘要挂在末尾。 */
function HistoryHeader({ entry }: { entry: DeployHistoryEntry }) {
  const tag = DEPLOY_STATUS_TAG[entry.status] ?? { color: 'default', text: entry.status };
  const duration = formatDuration(entry.startedAt, entry.finishedAt);
  // 产物直跑下版本戳才是权威口径；旧记录（无版本戳）退回 commit 级迁移，保证历史列表不空。
  const versionText = versionMigration(entry.fromVersion, entry.resultVersion, entry.targetVersion);
  const migrations = versionText
    ? [versionText]
    : ['server', 'web']
        .map((key) => commitMigration(key, entry.fromCommits, entry.resultCommits, entry.targetCommits))
        .filter((text): text is string => Boolean(text));
  return (
    <Space wrap size={8} style={WRAP_STYLE}>
      <Tag color={tag.color}>{tag.text}</Tag>
      <TimeText value={entry.startedAt ?? ''} />
      {duration && <Tag>耗时 {duration}</Tag>}
      {migrations.map((text) => (
        <Tag key={text}>{text}</Tag>
      ))}
      {entry.status === 'failed' && entry.error && (
        <Typography.Text type="danger" style={{ ...WRAP_STYLE, maxWidth: 360 }} ellipsis={{ tooltip: entry.error }}>
          {entry.error}
        </Typography.Text>
      )}
    </Space>
  );
}

/**
 * 部署历史：历次部署跑到终态的记录（新在前、上限 50），由部署脚本追加、后端只读回吐。
 * 每条默认只显示摘要，点开才展开完整日志——列表本身要一眼扫得过去，日志是按需看的细节。
 */
export function DeployHistoryList({ userId }: { userId: number }) {
  const query = useQuery({
    queryKey: ['deploy-history', userId],
    queryFn: ({ signal }) => fetchDeployHistory({ ...withIdentity(String(userId)), signal }),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (query.isPending) {
    return (
      <Space size={8}>
        <Spin aria-label="正在读取部署历史" />
        <Typography.Text type="secondary">正在读取部署历史…</Typography.Text>
      </Space>
    );
  }
  if (query.isError) {
    return <Alert type="error" showIcon message="部署历史读取失败" description={query.error.message} />;
  }
  const history = query.data ?? [];
  if (history.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无部署历史，运行部署脚本部署一次后会记录在这里" />;
  }
  return (
    <Collapse
      // 默认全收起：历史可能很多条，展开日志是按需动作。
      items={history.map((entry, index) => ({
        key: entry.runId ?? String(index),
        label: <HistoryHeader entry={entry} />,
        children: <HistoryLog entry={entry} />,
      }))}
    />
  );
}
