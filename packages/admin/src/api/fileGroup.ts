import { del, get, post, put, toQuery, withIdentity } from '../lib/http';
import type { DataScope } from '../lib/http';
import type { AxiosRequestConfig } from 'axios';

/**
 * 文件 / 视频分组接口（后端统一一张 file_group 表，靠 bizType 区分文档组与视频组）。
 *
 * 与相册分组同构：一个分组可含多份文件、一份文件可属多个分组（多对多，走 file_group_rel）。
 * 差别只有两点——分组不分家庭/个人而是分公共/私人（DataScope），且没有上下架三态：
 * 文件/视频分组删除即物理删（连带解绑），不像相册那样保留下架态。
 *
 * 分区口径与文档/视频本身一致：scope 走 query，私人组只落当前账号分区（ADMIN 无例外），
 * 所以每个请求都带 withIdentity（后端从令牌取当前账号推导 owner_id）。
 */

/** 分组业务类型：文档组 / 视频组 */
export type FileGroupBizType = 'document' | 'video';

/** 文件/视频分组（对应后端 FileGroupVO） */
export interface FileGroup {
  id: number;
  name: string;
  sort: number;
  bizType: FileGroupBizType;
  scope: DataScope;
  /** 组内文件数（后端统计，删除/解绑后随之变化） */
  fileCount?: number | null;
  creatorId?: number | null;
  createTime: string;
  updateTime: string;
}

export interface FileGroupSortItem {
  id: number;
  sort: number;
}

/** 分组列表：不分页，keyword 为空返回全部；私人组只返回当前账号的 */
export function listFileGroups(
  bizType: FileGroupBizType,
  keyword: string | undefined,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<FileGroup[]> {
  return get<FileGroup[]>(`/api/b/file/groups${toQuery({ bizType, keyword, scope })}`, config);
}

export function createFileGroup(
  bizType: FileGroupBizType,
  name: string,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<number> {
  return post<number>(`/api/b/file/groups${toQuery({ bizType, scope })}`, { name }, config);
}

/** 重命名（只改名称，排序走 /sort，删除走 DELETE） */
export function updateFileGroup(
  id: number,
  bizType: FileGroupBizType,
  name: string,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return put<void>(`/api/b/file/groups/${id}${toQuery({ bizType, scope })}`, { name }, config);
}

export function batchUpdateFileGroupSort(
  items: FileGroupSortItem[],
  bizType: FileGroupBizType,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return put<void>(`/api/b/file/groups/sort${toQuery({ bizType, scope })}`, { items }, config);
}

/** 删除分组：连带解绑组内全部文件（file_group_rel 外键级联），文件本身不删 */
export function deleteFileGroup(
  id: number,
  bizType: FileGroupBizType,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return del<void>(`/api/b/file/groups/${id}${toQuery({ bizType, scope })}`, config);
}

/** 整组覆盖某份文件的分组归属（仅允许同 scope + 同 bizType 的分组） */
export function setFileGroups(
  fileId: number,
  groupIds: number[],
  bizType: FileGroupBizType,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return put<void>(`/api/b/file/groups/files/${fileId}${toQuery({ bizType, scope })}`, { groupIds }, config);
}
