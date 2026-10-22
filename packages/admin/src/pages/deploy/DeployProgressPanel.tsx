import { useEffect, useMemo, useRef } from 'react';
import { Alert, Button, Card, Space, Spin, Tag, Timeline, Typography } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDeployProgress } from '../../api/deploy';
import { TimeText } from '../../components/TimeText';
import { withIdentity } from '../../lib/http';
import { DEPLOY_STATUS_TAG, shortOf } from './statusMeta';

/**
 * 部署进度视图：轮询后端读出的 deploy-status.json，实时展示每一步。
 *
 * <p>关键点是**扛住前后端重启的空窗**：Update 会杀掉后端（以及 Vite 代理），这几秒轮询必然连不上。
 * react-query 在后台 refetch 失败时**保留上一次成功的数据**，所以进度行不会闪没；配合无限重试 + 固定重试间隔，
 * 两边都起来后自动接上继续刷。空窗期用 failureCount>0 显示「服务重启中，正在等待恢复…」，绝不当成失败。
 */
export function DeployProgressPanel({
  userId,
  runId,
  onExit,
}: {
  userId: number;
  runId: string;
  onExit: () => void;
}) {
  const queryClient = useQueryClient();
  const logRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['deploy-progress', runId],
    queryFn: ({ signal }) => fetchDeployProgress(runId, { ...withIdentity(String(userId)), signal }),
    // 部署结束（done/failed）就停轮询，否则每 1.5s 刷一次。
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'done' || status === 'failed' ? false : 1500;
    },
    // 重启空窗期网络必然报错：无限重试、2s 间隔，等服务回来自动接上；期间保留上次数据不闪没。
    retry: true,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  const progress = query.data;
  const status = progress?.status ?? 'pending';
  const finished = status === 'done' || status === 'failed';
  // 后端/前端正在重启：轮询连着失败但还没到终态。
  const reconnecting = !finished && query.failureCount > 0;

  // 新进度行到来时自动滚到底部。
  const lineCount = progress?.lines?.length ?? 0;
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lineCount]);

  // 部署到终态后：让「当前运行」刷成新版本、并把这次刚落的记录刷进部署历史。
  // done/failed 都由分离部署进程写进了 deploy-history.json，返回部署管理页时两份数据都要重拉。
  useEffect(() => {
    if (finished) {
      void queryClient.invalidateQueries({ queryKey: ['change-log', userId] });
      void queryClient.invalidateQueries({ queryKey: ['deploy-history', userId] });
    }
  }, [finished, queryClient, userId]);

  const timelineItems = useMemo(
    () =>
      (progress?.lines ?? []).map((line, index) => ({
        key: index,
        color: line.level === 'error' ? 'red' : 'blue',
        children: (
          <Space size={8} style={{ alignItems: 'baseline' }}>
            <TimeText value={line.ts} />
            <Typography.Text type={line.level === 'error' ? 'danger' : undefined}>{line.message}</Typography.Text>
          </Space>
        ),
      })),
    [progress?.lines],
  );

  const tag = DEPLOY_STATUS_TAG[status];
  const target = progress?.targetCommits;

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <Card
        size="small"
        title={
          <Space wrap size={8}>
            <Tag color={tag.color}>{tag.text}</Tag>
            {progress?.phase && <Typography.Text strong>{progress.phase}</Typography.Text>}
            {reconnecting && <Typography.Text type="secondary">服务重启中，正在等待恢复…</Typography.Text>}
          </Space>
        }
        extra={
          finished && (
            <Button type="primary" onClick={onExit}>
              返回部署管理
            </Button>
          )
        }
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {target && (target.server || target.web) && (
            <Space wrap size={8}>
              <Typography.Text type="secondary">部署目标：</Typography.Text>
              {target.server && <Tag>后端 · {shortOf(target.server)}</Tag>}
              {target.web && <Tag>前端 · {shortOf(target.web)}</Tag>}
            </Space>
          )}
          {status === 'failed' && progress?.error && (
            <Alert type="error" showIcon message="部署失败" description={progress.error} />
          )}
          {status === 'done' && (
            <Alert
              type="success"
              showIcon
              message="已部署到最新代码并重启完成"
              description="前后端都已重启并通过健康检查，可返回部署管理查看新的运行版本与本次历史记录。"
            />
          )}
        </Space>
      </Card>

      <Card size="small" title="部署日志">
        <div ref={logRef} style={{ maxHeight: 460, overflowY: 'auto' }}>
          {timelineItems.length === 0 ? (
            <Space size={8}>
              <Spin aria-label="等待部署进度" />
              <Typography.Text type="secondary">正在等待部署脚本写出进度…</Typography.Text>
            </Space>
          ) : (
            <Timeline items={timelineItems} />
          )}
        </div>
      </Card>

      {!finished && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          部署期间前后端会重启，约几秒内页面请求会失败，属正常现象；请勿关闭本页，进度会自动恢复。
        </Typography.Text>
      )}
    </Space>
  );
}
