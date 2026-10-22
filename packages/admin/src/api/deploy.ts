import type { AxiosRequestConfig } from 'axios';
import { get } from '../lib/http';

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
  /** 本次部署前 / 目标 / 结果的产物版本戳（如 v20261022-cbd993a），用于「从 X 到 Y」的迁移展示。 */
  fromVersion?: string;
  targetVersion?: string;
  resultVersion?: string;
  /** 本次部署前两仓的 commit（引擎在替换产物之前抓），用于 commit 级迁移展示。 */
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
  /** 当前是否为产物直跑的部署机（有安装目录、能读到运行版本戳）；开发机为 false。 */
  enabled: boolean;
  /** 当前运行的产物版本戳（读 <install-dir>/app/version.json）；拿不到为空串。 */
  currentVersion?: string;
  /** 当前运行产物对应的两仓 commit。 */
  currentCommits?: DeployCommits;
  /** 本次探测时刻（ISO）。 */
  checkedAt?: string;
}

/** 部署能力探测：当前运行的产物版本戳与两仓 commit。离线部署包没有在线升级触发，此接口纯只读。 */
export function fetchDeployCapability(config?: AxiosRequestConfig): Promise<DeployCapability> {
  return get<DeployCapability>('/api/b/deploy/capability', config);
}

/** 读取部署历史（历次终态记录，新在前，最多 50 条）。未接入或还没有历史时返回空数组。 */
export function fetchDeployHistory(config?: AxiosRequestConfig): Promise<DeployHistoryEntry[]> {
  return get<DeployHistoryEntry[]>('/api/b/deploy/history', config);
}
