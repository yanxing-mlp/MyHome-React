import { Alert, Button, Card, Result, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can, PERMISSION, useCurrentUser } from '@family-home/shared/auth';
import { fetchChangeLog } from '../../api/changeLog';
import type { ChangeLogRepository } from '../../api/changeLog';
import { fetchDeployCapability } from '../../api/deploy';
import { PageShell } from '../../components/PageShell';
import { TimeText } from '../../components/TimeText';
import { withIdentity } from '../../lib/http';
import { DeployHistoryList } from './DeployHistoryList';
import { shortOf } from './statusMeta';

/** 当前运行版本标记：金色。 */
const RUNNING_TAG_COLOR = 'gold';
const REPO_LABEL: Record<string, string> = { server: '后端', web: '前端' };

function repoLabel(repo: ChangeLogRepository): string {
  return REPO_LABEL[repo.key] ?? repo.label.split('·')[0]?.trim() ?? repo.key;
}

/** 单仓一行：仓库名 + 分支 + 当前运行 commit → 仓库最新 commit（版本戳之下的 commit 明细补充）。 */
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
      {latest && <Tag>仓库最新 · {shortOf(latest)}</Tag>}
      {behind ? <Tag color="orange">仓库有新提交</Tag> : <Tag color="green">已同步</Tag>}
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

  const changeLogQuery = useQuery({
    queryKey: ['change-log', userId],
    queryFn: ({ signal }) => fetchChangeLog({ ...withIdentity(String(userId)), signal }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 当前运行的产物版本戳（读 <install-dir>/app/version.json）；开发机没有安装目录时 enabled=false。
  const capability = useQuery({
    queryKey: ['deploy-capability', userId],
    queryFn: ({ signal }) => fetchDeployCapability({ ...withIdentity(String(userId)), signal }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const changeLog = changeLogQuery.isError ? undefined : changeLogQuery.data;
  const cap = capability.data;
  const enabled = cap?.enabled ?? false;
  const currentVersion = cap?.currentVersion ?? '';
  const repositories = changeLog?.repositories ?? [];

  const refreshAll = () => {
    void changeLogQuery.refetch();
    void capability.refetch();
    void queryClient.invalidateQueries({ queryKey: ['deploy-history', userId] });
  };

  const actions = (
    <Space size={8}>
      <Button
        icon={<ReloadOutlined />}
        loading={changeLogQuery.isFetching || capability.isFetching}
        onClick={refreshAll}
      >
        刷新
      </Button>
    </Space>
  );

  return (
    <PageShell
      title="部署管理"
      actions={actions}
      toolbar={
        <Space wrap size={8}>
          <Tooltip title="这里展示当前部署机运行的产物版本与历次部署记录。本系统是离线部署包，没有在线升级入口：要更新到新版本，请手动放置新的离线部署包并按执行说明重新运行部署脚本；每次部署结束后都会记进下方「部署历史」。">
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
              <Tooltip title="当前运行环境不是产物直跑的部署机（例如开发机），没有运行版本戳，部署历史也为空。">
                <Tag>非部署机</Tag>
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
              <Space wrap size={8}>
                <Typography.Text strong>产物版本</Typography.Text>
                {currentVersion ? (
                  <Tooltip title="当前系统运行的就是这个产物版本。">
                    <Tag color={RUNNING_TAG_COLOR}>当前运行 · {currentVersion}</Tag>
                  </Tooltip>
                ) : (
                  <Tag>当前运行版本未知</Tag>
                )}
              </Space>

              {repositories.length > 0 && (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                  {repositories.map((repo) => (
                    <RepoVersionRow key={repo.key} repo={repo} />
                  ))}
                </Space>
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
