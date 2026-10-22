import type { AxiosRequestConfig } from 'axios';
import { get, put, toQuery } from '../lib/http';

/** 一个可查看的日志文件的元信息（不含内容）。 */
export interface LogFileMeta {
  /** 文件名（不是路径），tail 时原样传回。 */
  name: string;
  /** 当前字节大小。 */
  size: number;
  /** 最后修改时间（epoch millis），列表按它倒序。 */
  lastModified: number;
}

/**
 * 一次增量 tail 的结果。
 * - {@code offset}：下一次轮询要传回来的游标（已前进到最后一个完整行之后）。
 * - {@code lines}：本轮新增的完整行；没有新内容时为空数组。
 * - {@code rotated}：文件被轮转/截断或初次打开，前端应清空已有行、用本轮 lines 重建。
 */
export interface LogTail {
  file: string;
  offset: number;
  size: number;
  rotated: boolean;
  lines: string[];
}

/** 列出日志目录下的 *.log（按最后修改时间倒序）。开发机未落日志文件时返回空数组。 */
export function fetchLogFiles(config?: AxiosRequestConfig): Promise<LogFileMeta[]> {
  return get<LogFileMeta[]>('/api/b/logs/files', config);
}

/**
 * 从 {@code offset} 字节处增量读取指定日志文件的新行。
 * 初次打开传 {@code offset = -1}（服务端回溯读末尾一块并置 rotated=true）。
 */
export function fetchLogTail(file: string, offset: number, config?: AxiosRequestConfig): Promise<LogTail> {
  const qs = toQuery({ file, offset });
  return get<LogTail>(`/api/b/logs/tail${qs}`, config);
}

/** 日志保留天数的合法区间，与后端校验一致；前端 InputNumber 用它置灰非法值。 */
export const RETENTION_DAYS_MIN = 1;
export const RETENTION_DAYS_MAX = 365;

/**
 * 日志保留天数设置。
 * - {@code retentionDays}：当前保留天数（默认 7）。
 * - {@code available}：本运行环境是否可配置——开发机只打控制台、无日志目录时为 false，控件应置灰。
 */
export interface LogRetention {
  retentionDays: number;
  available: boolean;
}

/** 读取日志保留天数设置。 */
export function fetchLogRetention(config?: AxiosRequestConfig): Promise<LogRetention> {
  return get<LogRetention>('/api/b/logs/retention', config);
}

/** 设置日志保留天数（1..365），后端持久化并立即应用到 logback。 */
export function updateLogRetention(retentionDays: number, config?: AxiosRequestConfig): Promise<LogRetention> {
  return put<LogRetention>('/api/b/logs/retention', { retentionDays }, config);
}
