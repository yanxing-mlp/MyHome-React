import type { AxiosRequestConfig } from 'axios';
import { get, post, put, toQuery } from '../lib/http';

/**
 * 「代码仓库」接口封装（方案 v51）：与知识库同一套端点形状，只多一个 repo 参数区分后端(server)/前端(web)源码仓。
 * 类型与 api/knowledge.ts 逐字同构（后端 RepoController 与 KnowledgeController 复用同一个 RepoService 引擎，
 * 返回体一模一样）；这里各自定义一份而不共用，是为了让知识库那份保持 v49 原样、互不牵连。
 */

/** 仓库键：后端源码仓 / 前端源码仓。 */
export type RepoKey = 'server' | 'web';

/** 文件树里的一个节点（直接喂 antd Tree）。 */
export interface RepoNode {
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
  children?: RepoNode[];
}

/** 文件树接口的返回。available=false 表示当前环境未配置该仓库目录（开发机），前端显示空态。 */
export interface RepoTree {
  available: boolean;
  /** 仓库根目录名，标题旁展示。 */
  root: string;
  tree: RepoNode[];
}

/** 一个文本文件的完整内容。 */
export interface RepoFile {
  path: string;
  name: string;
  content: string;
  editable: boolean;
  size: number;
}

/** git 工作副本状态：分支 + 待提交改动清单，供「推送前预览」。 */
export interface RepoGitStatus {
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
export interface RepoPushResult {
  ok: boolean;
  committed: boolean;
  pushed: boolean;
  message: string;
  /** git 原始输出，失败时展示给超管排查。 */
  output?: string;
}

/** 列出某代码仓库的文件树。未配置目录时返回 available=false + 空树。 */
export function fetchRepoTree(repo: RepoKey, config?: AxiosRequestConfig): Promise<RepoTree> {
  return get<RepoTree>(`/api/b/repo/tree${toQuery({ repo })}`, config);
}

/** 读取一个文本文件的完整内容。path 为相对仓库根、/ 分隔的路径。 */
export function fetchRepoFile(
  repo: RepoKey,
  path: string,
  config?: AxiosRequestConfig,
): Promise<RepoFile> {
  return get<RepoFile>(`/api/b/repo/file${toQuery({ repo, path })}`, config);
}

/** 保存：把内容写回本地工作副本（不推送）。 */
export function saveRepoFile(
  repo: RepoKey,
  path: string,
  content: string,
  config?: AxiosRequestConfig,
): Promise<{ path: string; size: number }> {
  return put<{ path: string; size: number }>('/api/b/repo/file', { repo, path, content }, config);
}

/** 查询 git 工作副本状态（待推送改动清单）。 */
export function fetchRepoGitStatus(repo: RepoKey, config?: AxiosRequestConfig): Promise<RepoGitStatus> {
  return get<RepoGitStatus>(`/api/b/repo/git/status${toQuery({ repo })}`, config);
}

/** 一键推送：git add -A + commit -m <message> + push。 */
export function pushRepo(
  repo: RepoKey,
  message: string,
  config?: AxiosRequestConfig,
): Promise<RepoPushResult> {
  return post<RepoPushResult>('/api/b/repo/git/push', { repo, message }, config);
}
