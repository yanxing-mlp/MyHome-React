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

/** 单仓一行：仓库名 + 分支 + 当前运行 commit → 最新 commit（仅作版本戳之下的 commit 明细补充）。 */
function RepoVersionRow({ repo }: { repo: ChangeLogRepository }) {
  const latest = repo.commits[0]?.hash;
  const behind = Boolean(repo.runningCommit) && Boolean(latest) && latest !== repo.runningCommit;
  return (
    <Space wrap size={8} style={{ width: '100%' }}>
      <Typography.Text strong>{repoLabel(repo)}</Typography.Text>
      <Tag color="blue">{repo.branch}</Tag>
      {repo.runningCommit ? (
        <Tooltip title="当前运行的产物就是这个提交。">
          <Tag color={RUNNING_TAG_COLOR}>运行 · {shortOf(repo.runningCommit)}</Tag>
        </Tooltip>
      ) : (
        <Tag>运行 commit 未知</Tag>
      )}
      {latest && <Tag>最新 · {shortOf(latest)}</Tag>}
      {behind ? <Tag color="orange">有新提交</Tag> : <Tag color="green">已同步</Tag>}
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
  // 版本戳对比（当前 vs GitHub Release 最新）是「要不要更新」的唯一权威口径，不再靠 change-log 的 commit 推断。
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
  const cap = capability.data;
  const enabled = cap?.enabled ?? false;
  const currentVersion = cap?.currentVersion ?? '';
  const latestVersion = cap?.latestVersion ?? '';
  const updateAvailable = cap?.updateAvailable ?? false;
  const releaseError = cap?.releaseError ?? null;
  const repositories = changeLog?.repositories ?? [];

  const versionKnown = Boolean(currentVersion) || Boolean(latestVersion);
  const canDeploy = enabled && updateAvailable && !deployRunId;

  const refreshAll = () => {
    void changeLogQuery.refetch();
    void capability.refetch();
    void queryClient.invalidateQueries({ queryKey: ['deploy-history', userId] });
  };

  const deployDescription = useMemo(
    () => (
      <Space orientation="vertical" size={4}>
        <span>
          将从 GitHub Release 下载最新产物包
          {latestVersion ? `（版本 ${latestVersion}）` : ''}
          替换当前{currentVersion ? ` ${currentVersion}` : ''} 并重启后端，重启期间约几秒不可用。
        </span>
        {repositories.map((repo) => (
          <span key={repo.key}>
            {repoLabel(repo)}：{shortOf(repo.runningCommit ?? '')} → {shortOf(repo.commits[0]?.hash ?? '')}
          </span>
        ))}
      </Space>
    ),
    [currentVersion, latestVersion, repositories],
  );

  const actions = (
    <Space size={8}>
      {canDeploy && (
        <Popconfirm
          title="部署最新版本"
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
      <Button
        icon={<ReloadOutlined />}
        loading={changeLogQuery.isFetching || capability.isFetching}
        onClick={refreshAll}
      >
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
          <Tooltip title="在这里把已部署的实例更新到最新产物版本：点「部署最新」会从 GitHub Release 下载校验后的产物包、原子替换本地文件并重启后端，全程可看实时进度；每次部署结束后都会记进下方「部署历史」。只有产物直跑的部署机支持在线更新，开发机上这个入口不显示。">
            <QuestionCircleOutlined aria-label="部署管理口径" tabIndex={0} style={{ color: '#8c8c8c' }} />
          </Tooltip>
          {cap?.checkedAt && <TimeText value={cap.checkedAt} label="版本检查于" />}
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
          {capability.isError ? (
            <Alert type="error" showIcon message="部署能力读取失败" description={capability.error.message} />
          ) : !cap ? (
            <Spin aria-label="正在读取版本信息" />
          ) : (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {versionKnown ? (
                <Space wrap size={8}>
                  <Typography.Text strong>产物版本</Typography.Text>
                  {currentVersion ? (
                    <Tooltip title="当前系统运行的就是这个产物版本。">
                      <Tag color={RUNNING_TAG_COLOR}>当前运行 · {currentVersion}</Tag>
                    </Tooltip>
                  ) : (
                    <Tag>当前运行版本未知</Tag>
                  )}
                  {latestVersion ? (
                    <Tag>最新 · {latestVersion}</Tag>
                  ) : (
                    <Tooltip title="没能取到 GitHub Release 上的最新版本，无法判断是否需要更新。">
                      <Tag>最新版本未知</Tag>
                    </Tooltip>
                  )}
                  {currentVersion && latestVersion && (
                    updateAvailable ? <Tag color="orange">可更新</Tag> : <Tag color="green">已是最新</Tag>
                  )}
                </Space>
              ) : (
                <Typography.Text type="secondary">暂无产物版本信息。</Typography.Text>
              )}

              {releaseError && <Alert type="warning" showIcon message={releaseError} />}

              {repositories.length > 0 && (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                  {repositories.map((repo) => (
                    <RepoVersionRow key={repo.key} repo={repo} />
                  ))}
                </Space>
              )}

              {enabled && currentVersion && latestVersion && !updateAvailable && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  已是最新产物版本，无需部署。
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
