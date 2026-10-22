import type { AxiosRequestConfig } from 'axios';
import { get, put, toQuery } from '../lib/http';
import type { PageResult } from '../lib/http';

/** 一条操作审计记录（对应后端 OperationLogDO）。 */
export interface OperationLog {
  id: number;
  /** B=管理端 / C=家庭端 */
  source: string;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  /** 前端 X-Op-Page 头带的中文页面名 */
  page?: string | null;
  /** 中文动作（动作字典翻译） */
  action: string;
  httpMethod: string;
  uri: string;
  /** 脱敏后的入参 JSON 文本 */
  requestParams?: string | null;
  /** 脱敏 + 截断后的响应摘要 JSON 文本 */
  responseSummary?: string | null;
  /** 1=成功 0=失败 */
  success: number;
  errorCode?: string | null;
  durationMs: number;
  clientIp?: string | null;
  /** 请求链路 id（v46），与该请求的日志行、响应头 X-Trace-Id 同值；V600 前的历史行为 null */
  traceId?: string | null;
  createTime: string;
}

/** 分页查询参数（全部可选）。 */
export interface OperationLogQuery {
  pageNo: number;
  pageSize: number;
  source?: string;
  userId?: number;
  success?: number;
  startTime?: number;
  endTime?: number;
  keyword?: string;
}

/** 分页查操作记录，按时间倒序。 */
export function fetchOperationLogs(
  query: OperationLogQuery,
  config?: AxiosRequestConfig,
): Promise<PageResult<OperationLog>> {
  const qs = toQuery({
    pageNo: query.pageNo,
    pageSize: query.pageSize,
    source: query.source,
    userId: query.userId,
    success: query.success,
    startTime: query.startTime,
    endTime: query.endTime,
    keyword: query.keyword,
  });
  return get<PageResult<OperationLog>>(`/api/b/operation-logs${qs}`, config);
}

/** 保留天数合法区间，与后端校验一致；前端 InputNumber 用它置灰非法值。 */
export const OP_RETENTION_DAYS_MIN = 1;
export const OP_RETENTION_DAYS_MAX = 365;

/** 操作记录保留天数设置。available 恒 true（DB 单行配置，任何环境都可改）。 */
export interface OperationLogRetention {
  retentionDays: number;
  available: boolean;
}

export function fetchOperationLogRetention(config?: AxiosRequestConfig): Promise<OperationLogRetention> {
  return get<OperationLogRetention>('/api/b/operation-logs/retention', config);
}

export function updateOperationLogRetention(
  retentionDays: number,
  config?: AxiosRequestConfig,
): Promise<OperationLogRetention> {
  return put<OperationLogRetention>('/api/b/operation-logs/retention', { retentionDays }, config);
}
