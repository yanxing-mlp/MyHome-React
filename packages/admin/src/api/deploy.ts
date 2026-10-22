import type { AxiosRequestConfig } from 'axios';
import { get, post } from '../lib/http';

/** 本次部署两仓的目标 / 结果 commit（完整 hash）。 */
export interface DeployCommits {
  server?: string;
  web?: string;
}

/** 一行进度：部署脚本 Set-Step 实时写出的步骤。 */
export interface DeployLine {
  ts: string;
  message: string;
  level?: 'info' | 'error';
}

/**
 * 部署状态。pending=后端刚点火、脚本还没写出文件；running=进行中；done=成功；failed=失败。
 * 前后端重启那几秒轮询会连不上（网络错误），那不是 failed——前端靠 failureCount 显示「服务重启中」并继续轮询。
 */
export type DeployStatus = 'pending' | 'running' | 'done' | 'failed';

export interface DeployProgress {
  runId?: string;
  status: DeployStatus;
  phase?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  /** 本次部署前两仓的 HEAD（部署脚本在 git pull 之前抓），用于「从 X 到 Y」的迁移展示。 */
  fromCommits?: DeployCommits;
  targetCommits?: DeployCommits;
  resultCommits?: DeployCommits;
  lines?: DeployLine[];
}

/**
 * 一条部署历史 = 一次部署跑到终态（done/failed）时的完整状态快照，字段与实时进度同构。
 * 由部署脚本追加进 logs/deploy-history.json（新在前、上限 50），后端 /deploy/history 只读回吐。
 */
export type DeployHistoryEntry = DeployProgress;

export interface DeployCapability {
  /** 当前运行环境是否接入了一键部署（只有源码直跑的部署机为 true，开发机为 false）。 */
  enabled: boolean;
}

/** 是否接入「一键部署」。前端据此决定要不要显示「部署最新」入口。 */
export function fetchDeployCapability(config?: AxiosRequestConfig): Promise<DeployCapability> {
  return get<DeployCapability>('/api/b/deploy/capability', config);
}

/** 触发一次「部署最新」：git pull 两仓 + 重启前后端。返回 runId 供轮询进度。 */
export function triggerDeployLatest(config?: AxiosRequestConfig): Promise<{ runId: string }> {
  return post<{ runId: string }>('/api/b/deploy/latest', undefined, config);
}

/** 读取最近一次部署的完整进度状态。 */
export function fetchDeployProgress(runId?: string, config?: AxiosRequestConfig): Promise<DeployProgress> {
  const qs = runId ? `?runId=${encodeURIComponent(runId)}` : '';
  return get<DeployProgress>(`/api/b/deploy/progress${qs}`, config);
}

/** 读取部署历史（历次终态记录，新在前，最多 50 条）。未接入或还没有历史时返回空数组。 */
export function fetchDeployHistory(config?: AxiosRequestConfig): Promise<DeployHistoryEntry[]> {
  return get<DeployHistoryEntry[]>('/api/b/deploy/history', config);
}
