import { useMemo, useState } from 'react';
import { Alert, Button, Card, Popconfirm, Result, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { CloudDownloadOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';
import { fetchChangeLog } from '../../api/changeLog';
import type { ChangeLogRepository } from '../../api/changeLog';
import { fetchDeployCapability, triggerDeployLatest } from '../../api/deploy';
import { PageShell } from '../../components/PageShell';
import { TimeText } from '../../components/TimeText';
import { useApiMutation } from '../../hooks/useApiMutation';
import { withIdentity } from '../../lib/http';
import { DeployHistoryList } from './DeployHistoryList';
import { DeployProgressPanel } from './DeployProgressPanel';
import { shortOf } from './statusMeta';

/** 当前运行版本标记：金色，和「最新 / 落后」状态色区分。 */
const RUNNING_TAG_COLOR = 'gold';
const REPO_LABEL: Record<string, string> = { server: '后端', web: '前端' };

function repoLabel(repo: ChangeLogRepository): string {
  return REPO_LABEL[repo.key] ?? repo.label.split('·')[0]?.trim() ?? repo.key;
}

/** 某仓是否落后：有运行版本、有最新提交，且两者不同。 */
function isBehind(repo: ChangeLogRepository): boolean {
  const latest = repo.commits[0]?.hash;
  return Boolean(repo.runningCommit) && Boolean(latest) && latest !== repo.runningCommit;
}

/** 单仓一行：仓库名 + 分支 + 当前运行 → 最新 + 状态标记。 */
function RepoVersionRow({ repo }: { repo: ChangeLogRepository }) {
  const behind = isBehind(repo);
  const latest = repo.commits[0]?.hash;
  return (
    <Space wrap size={8} style={{ width: '100%' }}>
      <Typography.Text strong>{repo.label}</Typography.Text>
      <Tag color="blue">{repo.branch}</Tag>
      {repo.runningCommit ? (
        <Tooltip title="当前系统运行的就是这个提交。">
          <Tag color={RUNNING_TAG_COLOR}>当前运行 · {shortOf(repo.runningCommit)}</Tag>
        </Tooltip>
      ) : (
        <Tag>当前运行未知</Tag>
      )}
      {latest && <Tag>最新 · {shortOf(latest)}</Tag>}
      {behind ? <Tag color="orange">可更新</Tag> : <Tag color="green">已是最新</Tag>}
    </Space>
  );
}

/** 先隔离权限再挂载数据组件，普通成员不会创建任何部署相关查询。 */
export function DeployPage() {
  const user = useCurrentUser();
  if (!user || !can(user, PERMISSION.DEPLOY_ACCESS)) return <Result status="403" title="只有超级管理员能管理部署" />;
  return <DeployContent key={user.id} userId={user.id} />;
}

function DeployContent({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  // 非空即进入实时进度视图（替换掉下面的版本卡 + 历史）；部署结束点「返回」再清空。
  const [deployRunId, setDeployRunId] = useState<string | null>(null);

  const changeLogQuery = useQuery({
    queryKey: ['change-log', userId],
    queryFn: ({ signal }) => fetchChangeLog({ ...withIdentity(String(userId)), signal }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 只有接入了一键部署的运行环境才拉这个能力位；开发机 enabled=false，不显示「部署最新」入口。
  const capability = useQuery({
    queryKey: ['deploy-capability', userId],
    queryFn: ({ signal }) => fetchDeployCapability({ ...withIdentity(String(userId)), signal }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const deployMutation = useApiMutation(() => triggerDeployLatest(withIdentity(String(userId))), {
    onSettledSuccess: (data) => setDeployRunId(data.runId),
  });

  const changeLog = changeLogQuery.isError ? undefined : changeLogQuery.data;
  const enabled = capability.data?.enabled ?? false;
  const repositories = changeLog?.repositories ?? [];

  const behindRepos = useMemo(
    () => (enabled ? repositories.filter(isBehind) : []),
    [enabled, repositories],
  );
  const canDeploy = behindRepos.length > 0 && !deployRunId;

  const refreshAll = () => {
    void changeLogQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['deploy-history', userId] });
  };

  const deployDescription = (
    <Space orientation="vertical" size={4}>
      <span>将拉取以下仓的最新代码并重启前后端，重启期间约几秒不可用。</span>
      {behindRepos.map((repo) => (
        <span key={repo.key}>
          {repoLabel(repo)}：{shortOf(repo.runningCommit ?? '')} → {shortOf(repo.commits[0]?.hash ?? '')}
        </span>
      ))}
    </Space>
  );

  const actions = (
    <Space size={8}>
      {canDeploy && (
        <Popconfirm
          title="部署最新代码"
          description={deployDescription}
          okText="部署"
          cancelText="取消"
          onConfirm={() => deployMutation.mutate()}
        >
          <Button type="primary" icon={<CloudDownloadOutlined />} loading={deployMutation.isPending}>
            部署最新
          </Button>
        </Popconfirm>
      )}
      <Button icon={<ReloadOutlined />} loading={changeLogQuery.isFetching} onClick={refreshAll}>
        刷新
      </Button>
    </Space>
  );

  if (deployRunId) {
    return (
      <PageShell title="部署管理" actions={actions}>
        <DeployProgressPanel userId={userId} runId={deployRunId} onExit={() => setDeployRunId(null)} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="部署管理"
      actions={actions}
      toolbar={
        <Space wrap size={8}>
          <Tooltip title="在这里把已部署的实例更新到两仓最新代码：点「部署最新」会 git pull 前后端并重启服务，全程可看实时进度；每次部署结束后都会记进下方「部署历史」。只有源码直跑的部署机支持在线更新，开发机上这个入口不显示。">
            <QuestionCircleOutlined aria-label="部署管理口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
          </Tooltip>
          {changeLog?.generatedAt && <TimeText value={changeLog.generatedAt} label="版本信息更新于" />}
        </Space>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card
          size="small"
          title="当前版本"
          extra={
            enabled ? undefined : (
              <Tooltip title="当前运行环境未接入一键部署（例如开发机），无法在线更新，部署历史也为空。">
                <Tag>未接入一键部署</Tag>
              </Tooltip>
            )
          }
        >
          {changeLogQuery.isError ? (
            <Alert type="error" showIcon message="版本信息读取失败" description={changeLogQuery.error.message} />
          ) : !changeLog ? (
            <Spin aria-label="正在读取版本信息" />
          ) : repositories.length === 0 ? (
            <Typography.Text type="secondary">暂无版本信息。</Typography.Text>
          ) : (
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              {repositories.map((repo) => (
                <RepoVersionRow key={repo.key} repo={repo} />
              ))}
              {enabled && behindRepos.length === 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  前后端都已是最新，无需部署。
                </Typography.Text>
              )}
            </Space>
          )}
        </Card>

        <Card size="small" title="部署历史">
          <DeployHistoryList userId={userId} />
        </Card>
      </Space>
    </PageShell>
  );
}
