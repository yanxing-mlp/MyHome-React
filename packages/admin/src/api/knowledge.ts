import type { AxiosRequestConfig } from 'axios';
import { get, post, put, toQuery } from '../lib/http';

/** 文件树里的一个节点（直接喂 antd Tree）。 */
export interface KnowledgeNode {
  /** 相对仓库根、以 / 分隔的路径，既是 Tree 的 key 也是读写文件时回传的 path。 */
  key: string;
  /** 文件名（含扩展名），Tree 上展示。 */
  title: string;
  /** 是否目录。目录不可编辑、只用于展开。 */
  dir: boolean;
  /** 是否可在线编辑（文本白名单）。二进制为 false，前端不给打开编辑器的入口。 */
  editable: boolean;
  /** 文件字节大小（目录无此值）。 */
  size?: number;
  children?: KnowledgeNode[];
}

/** 文件树接口的返回。available=false 表示当前环境未配置知识库目录（开发机），前端显示空态。 */
export interface KnowledgeTree {
  available: boolean;
  /** 仓库根目录名，标题旁展示。 */
  root: string;
  tree: KnowledgeNode[];
}

/** 一个文本文件的完整内容。 */
export interface KnowledgeFile {
  path: string;
  name: string;
  content: string;
  editable: boolean;
  size: number;
}

/** git 工作副本状态：分支 + 待提交改动清单，供「推送前预览」。 */
export interface KnowledgeGitStatus {
  available: boolean;
  /** 该目录是不是 git 仓库。false 时只能本地编辑、无法推送。 */
  git: boolean;
  branch: string;
  /** 无待提交改动且不领先上游。 */
  clean: boolean;
  /** 是否配了上游分支（决定 push 能否直接推）。 */
  hasUpstream: boolean;
  /** 本地领先上游几个提交。 */
  ahead: number;
  changed: { path: string; status: string }[];
}

/** 一键推送的结果。 */
export interface KnowledgePushResult {
  ok: boolean;
  committed: boolean;
  pushed: boolean;
  message: string;
  /** git 原始输出，失败时展示给超管排查。 */
  output?: string;
}

/** 列出知识库文件树。未配置 repo-dir 时返回 available=false + 空树。 */
export function fetchKnowledgeTree(config?: AxiosRequestConfig): Promise<KnowledgeTree> {
  return get<KnowledgeTree>('/api/b/knowledge/tree', config);
}

/** 读取一个文本文件的完整内容。path 为相对仓库根、/ 分隔的路径。 */
export function fetchKnowledgeFile(path: string, config?: AxiosRequestConfig): Promise<KnowledgeFile> {
  return get<KnowledgeFile>(`/api/b/knowledge/file${toQuery({ path })}`, config);
}

/** 保存：把内容写回本地工作副本（不推送）。 */
export function saveKnowledgeFile(
  path: string,
  content: string,
  config?: AxiosRequestConfig,
): Promise<{ path: string; size: number }> {
  return put<{ path: string; size: number }>('/api/b/knowledge/file', { path, content }, config);
}

/** 查询 git 工作副本状态（待推送改动清单）。 */
export function fetchKnowledgeGitStatus(config?: AxiosRequestConfig): Promise<KnowledgeGitStatus> {
  return get<KnowledgeGitStatus>('/api/b/knowledge/git/status', config);
}

/** 一键推送：git add -A + commit -m <message> + push。 */
export function pushKnowledge(message: string, config?: AxiosRequestConfig): Promise<KnowledgePushResult> {
  return post<KnowledgePushResult>('/api/b/knowledge/git/push', { message }, config);
}
