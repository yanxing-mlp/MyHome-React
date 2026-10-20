import type { AxiosRequestConfig } from 'axios';
import { get } from '../lib/http';

export interface ChangeLogCommit {
  hash: string;
  shortHash: string;
  author: string;
  /** 提交时间，ISO-8601：实时源为 UTC（…Z），快照源带时区偏移（…+08:00），两者 Date 均可解析 */
  date: string;
  /** 提交标题（git %s / GitHub message 首行） */
  message: string;
}

/** 单仓数据来源：live=实时拉 GitHub，snapshot=回退构建期快照，unavailable=两者都拿不到 */
export type ChangeLogSource = 'live' | 'snapshot' | 'unavailable';

/** 顶层来源：mixed=一仓实时一仓快照；其余同 ChangeLogSource */
export type ChangeLogTopSource = ChangeLogSource | 'mixed';

export interface ChangeLogRepository {
  key: 'server' | 'web';
  label: string;
  branch: string;
  commitCount: number;
  commits: ChangeLogCommit[];
  source?: ChangeLogSource;
}

export interface ChangeLog {
  /** 快照兜底时为构建期生成时间；实时/不可用时为本次组装时间 */
  generatedAt: string | null;
  repositories: ChangeLogRepository[];
  source?: ChangeLogTopSource;
}

/** 变更记录：前后端两仓当前分支的提交历史（实时优先、快照兜底，仅 ADMIN）。 */
export function fetchChangeLog(config?: AxiosRequestConfig): Promise<ChangeLog> {
  return get<ChangeLog>('/api/b/change-log', config);
}
