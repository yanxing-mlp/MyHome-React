import { del, get, http, post, put, toQuery } from '../lib/http';
import type { ContentStatus, PageRequest, PageResult } from '@family-home/shared/http';

/** 家庭与个人相册独立；个人数据的属主始终由后端从当前账号推导。 */
export type AlbumGroupScope = 'FAMILY' | 'PERSONAL';

/** 相册分组 */
export interface AlbumGroup {
  id: number;
  name: string;
  sort: number;
  /** 下架只影响分组的 C 端展示，不连带改变图片状态。个人分组沿用无开关交互。 */
  status: ContentStatus;
  scope: AlbumGroupScope;
  imageCount?: number;
  /** 添加人（app_user.id）；个人分组的属主 */
  creatorId?: number | null;
  createTime: string;
  updateTime: string;
}

/** 新建分组的 scope 仍放在 body，不接受前端指定属主。 */
export interface AlbumGroupInput {
  name: string;
  scope: AlbumGroupScope;
}

/** name / status 各自判 null；删除走独立接口。 */
export interface AlbumGroupUpdateInput {
  name?: string;
  status?: ContentStatus;
}

export interface GroupSortItem {
  id: number;
  sort: number;
}

/** EXIF 随绑定落到 album_image，不能随 /file/upload 上传。 */
export interface AlbumImageBindItem {
  fileId: number;
  city?: string;
  lng?: number;
  lat?: number;
  /** 后端 LocalDateTime：YYYY-MM-DDTHH:mm:ss，不带 Z */
  shootTime?: string;
}

export interface AlbumImageBindRequest {
  items: AlbumImageBindItem[];
}

/** 图片视图（后端 AlbumImageVO） */
export interface AlbumImage {
  id: number;
  /** 同域内可以属于多个分组；无分组图片仅在家庭 C 端展示为“其他”。 */
  groupIds: number[];
  fileId: string;
  url: string;
  thumbUrl?: string;
  city?: string;
  pinned: number;
  status: ContentStatus;
  lng?: number;
  lat?: number;
  shootTime?: string;
  creatorId?: number | null;
  createTime: string;
  updateTime: string;
}

export interface AlbumImageQuery extends PageRequest {
  scope: AlbumGroupScope;
  groupId?: number;
  city?: string;
  keyword?: string;
}

/** city / status 独立更新；EXIF 仅在首次绑定时写入。 */
export interface AlbumImageUpdateInput {
  city?: string;
  status?: ContentStatus;
}

export interface AlbumImagePinInput {
  pinned: boolean;
}

// ==================== 分组接口 ====================

/** 不分页，含下架分组；PERSONAL 只返回当前账号的数据。 */
export function listAlbumGroups(keyword: string | undefined, scope: AlbumGroupScope, signal?: AbortSignal): Promise<AlbumGroup[]> {
  return get<AlbumGroup[]>(`/api/b/album/groups${toQuery({ keyword, scope })}`, { signal });
}

export function createAlbumGroup(input: AlbumGroupInput): Promise<number> {
  return post<number>('/api/b/album/groups', input);
}

export function updateAlbumGroup(id: number, input: AlbumGroupUpdateInput, scope: AlbumGroupScope): Promise<void> {
  return put<void>(`/api/b/album/groups/${id}${toQuery({ scope })}`, input);
}

export function batchUpdateGroupSort(items: GroupSortItem[], scope: AlbumGroupScope): Promise<void> {
  return put<void>(`/api/b/album/groups/sort${toQuery({ scope })}`, { items });
}

export function deleteAlbumGroup(id: number, scope: AlbumGroupScope): Promise<void> {
  return del<void>(`/api/b/album/groups/${id}${toQuery({ scope })}`);
}

export interface BindImagesResult {
  added: number;
  /** 同分组内 md5 重复的 fileId，提示用户哪些图片被跳过 */
  skippedDuplicates: number[];
}

export function bindImagesToGroup(
  groupId: number,
  request: AlbumImageBindRequest,
  scope: AlbumGroupScope,
): Promise<BindImagesResult> {
  return post<BindImagesResult>(`/api/b/album/groups/${groupId}/images${toQuery({ scope })}`, request);
}

// ==================== 图片接口 ====================

export function pageAlbumImages(query: AlbumImageQuery, signal?: AbortSignal): Promise<PageResult<AlbumImage>> {
  return get<PageResult<AlbumImage>>(`/api/b/album/images${toQuery(query)}`, { signal });
}

export function updateAlbumImage(id: number, input: AlbumImageUpdateInput, scope: AlbumGroupScope): Promise<void> {
  return put<void>(`/api/b/album/images/${id}${toQuery({ scope })}`, input);
}

export function toggleAlbumImagePin(id: number, input: AlbumImagePinInput, scope: AlbumGroupScope): Promise<void> {
  return put<void>(`/api/b/album/images/${id}/pin${toQuery({ scope })}`, input);
}

export function deleteAlbumImage(id: number, scope: AlbumGroupScope): Promise<void> {
  return del<void>(`/api/b/album/images/${id}${toQuery({ scope })}`);
}

export async function batchDeleteAlbumImages(ids: number[], scope: AlbumGroupScope): Promise<void> {
  // 服务端 BatchDeleteRequest 是对象，不是裸数组。
  await http.request<void>({
    url: `/api/b/album/images${toQuery({ scope })}`,
    method: 'DELETE',
    data: { ids },
  });
}

// ==================== 城市接口 ====================

export interface AlbumCity {
  city: string;
  count: number;
}

export function listAlbumCities(scope: AlbumGroupScope, signal?: AbortSignal): Promise<AlbumCity[]> {
  return get<AlbumCity[]>(`/api/b/album/cities${toQuery({ scope })}`, { signal });
}

export function recalculateAlbumCities(scope: AlbumGroupScope): Promise<void> {
  return post<void>(`/api/b/album/cities/recalculate${toQuery({ scope })}`);
}

// ==================== 图片分组关联接口 ====================

export function getImageGroups(imageId: number, scope: AlbumGroupScope, signal?: AbortSignal): Promise<number[]> {
  return get<number[]>(`/api/b/album/images/${imageId}/groups${toQuery({ scope })}`, { signal });
}

/** 整组覆盖，仅允许同 scope 的分组。 */
export function setImageGroups(imageId: number, groupIds: number[], scope: AlbumGroupScope): Promise<void> {
  return put<void>(`/api/b/album/images/${imageId}/groups${toQuery({ scope })}`, { groupIds });
}

// ==================== 存储信息 ====================

export interface StorageInfo {
  rootDirectory: string;
  urlPrefix: string;
  structure: string;
}

export function getStorageInfo(): Promise<StorageInfo> {
  return get<StorageInfo>('/api/b/file/storage-info');
}

// ==================== 文件上传 ====================

export interface UploadImageResponse {
  id: number;
  url: string;
  thumbUrl?: string;
  originName?: string;
  md5: string;
  mimeType?: string;
  ext?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  bizType?: string;
}

/**
 * 上传图片到后端。
 *
 * <p>只带 `file` + `bizType` 两个 part（服务端 `FileController.upload` 就收这两个）。EXIF **不走这里**：
 * `file_object` 没有 lng/lat/shoot_time 那几列，文件域存不了；要落库就放进绑定项，
 * 见 {@link AlbumImageBindItem}。
 *
 * @param file 已由前端 canvas 转成 JPEG 的文件
 * @param bizType 业务类型，取值见后端 `file_object.biz_type` 列注释：相册图 'ALBUM_IMAGE'、菜谱封面 'RECIPE_IMAGE'
 *                （C 端上传用同一个 ALBUM_IMAGE；服务端只对 'document' 做等值判断，其余只是统计标签）
 */
export async function uploadImage(file: File, bizType: string): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bizType', bizType);
  return post<UploadImageResponse>('/api/b/file/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
