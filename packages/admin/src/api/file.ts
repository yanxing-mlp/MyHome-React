import { del, get, http, post, toQuery, withIdentity } from '../lib/http';
import type { DataScope } from '../lib/http';
import type { AxiosRequestConfig } from 'axios';

/**
 * 文件管理（文档）接口。
 *
 * 后端一期不分页：家庭量级几十份，列表整表返回。
 * 图片上传仍走 api/album.ts 的 uploadImage（/api/b/file/upload），两条路互不影响。
 */

/** 文件分类字典项；分区由请求上下文确定，后端只返回 id/name。 */
export interface FileCategory {
  id: number;
  name: string;
}

/** 文档文件（对应后端 DocumentFileVO） */
export interface DocumentFile {
  id: number;
  scope: DataScope;
  ownerId: number | null;
  /** 上传时的原始文件名，含扩展名 */
  name: string;
  categoryId: number | null;
  /** 分类名；分类被删时为 null */
  categoryName: string | null;
  /** 文件扩展名，由服务端解析 */
  fileType: string;
  fileSize: number;
  /** PUBLIC 为静态资源地址；PRIVATE 必须通过带身份的下载接口，地址为 null。 */
  url: string | null;
  /** 添加人（app_user.id） */
  creatorId?: number | null;
  createTime: string;
}

// ==================== 分类字典 ====================

export function listFileCategories(
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<FileCategory[]> {
  return get<FileCategory[]>(`/api/b/file/categories${toQuery({ scope })}`, config);
}

/** 新建分类；重名后端返 409 + 可直接展示的中文 */
export function createFileCategory(
  name: string,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<number> {
  return post<number>(`/api/b/file/categories${toQuery({ scope })}`, { name }, config);
}

// ==================== 文档 ====================

/** 列表：categoryId 不传 = 全部，最近上传在前 */
export function listDocuments(
  categoryId?: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<DocumentFile[]> {
  return get<DocumentFile[]>(`/api/b/file/documents${toQuery({ categoryId, scope })}`, config);
}

/** 上传一份文档。分类必选，不限文件格式；分区在 query，不放进 multipart。 */
export function uploadDocument(
  file: File,
  categoryId: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<DocumentFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('categoryId', String(categoryId));
  return post<DocumentFile>(`/api/b/file/documents${toQuery({ scope })}`, formData, {
    ...config,
    headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
  });
}

export function deleteDocument(
  id: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return del<void>(`/api/b/file/documents/${id}${toQuery({ scope })}`, config);
}

/** 原始二进制，不经过 Result unwrap，也不进入 query/mutation cache。 */
export async function downloadDocument(
  id: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<Blob> {
  const response = await http.get<Blob>(`/api/b/file/documents/${id}/download${toQuery({ scope })}`, {
    ...config,
    responseType: 'blob',
  });
  return response.data;
}
