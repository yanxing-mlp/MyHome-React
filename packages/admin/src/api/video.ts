import { del, get, post, toQuery, withIdentity } from '../lib/http';
import type { DataScope } from '../lib/http';
import type { AxiosRequestConfig } from 'axios';

/**
 * 视频管理接口。
 *
 * 与文档同一套分区口径：scope 走 query，公共/私人两档，私人只落当前账号分区（ADMIN 无例外）。
 * 视频复用 file_object（biz_type='video'），列表整表返回、不分页——家庭量级几十支。
 *
 * 播放不给静态 url：`<video src>` 由浏览器直接发 GET，带不上 Authorization 头，
 * 所以列表每行返回一枚**短时签名票据**拼进 playUrl，前端拼上 base 后直接塞进播放器。
 */

/** 视频行（对应后端 VideoVO） */
export interface VideoItem {
  id: number;
  /** 上传时的原始文件名，含扩展名 */
  name: string;
  /** 扩展名大写，如 MP4 / MOV */
  fileType: string;
  mimeType: string;
  fileSize: number;
  /** 所属分组 id（可多个）；视频没有分类，分组是唯一的归类维度 */
  groupIds: number[];
  /** 所属分组名，与 groupIds 同序 */
  groupNames: string[];
  /** 添加人（app_user.id） */
  creatorId?: number | null;
  /** 服务端根相对播放地址 /api/b/video/{id}/stream?ticket=...，带短时签名 */
  playUrl: string;
  scope: DataScope;
  ownerId: number | null;
  createTime: string;
}

/**
 * 把服务端根相对的 playUrl 拼成浏览器能直接请求的地址。
 *
 * admin 的 BASE_URL 是 '/admin/'，Vite 只把 '/admin/api' 代理到后端；
 * 裸 '/api' 不会被转发。所以这里去掉尾斜杠再拼：'/admin' + '/api/b/video/...'。
 */
export function resolvePlayUrl(playUrl: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '') + playUrl;
}

/** 列表：最近上传在前，每行带现签的播放票据。groupId 用于分组详情页。 */
export function listVideos(
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
  groupId?: number,
): Promise<VideoItem[]> {
  return get<VideoItem[]>(`/api/b/video${toQuery({ scope, groupId })}`, config);
}

/**
 * 上传一支视频。类型由服务端按文件名解析校验（非视频 415），前端不传。
 * 分组可选（留空=未分组），一份视频可属多个分组。
 * onProgress 用于大文件进度条：视频动辄几十上百 MB，没进度条用户会以为卡死。
 */
export function uploadVideo(
  file: File,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
  onProgress?: (percent: number) => void,
  groupIds?: number[],
): Promise<VideoItem> {
  const formData = new FormData();
  formData.append('file', file);
  groupIds?.forEach((id) => formData.append('groupIds', String(id)));
  return post<VideoItem>(`/api/b/video${toQuery({ scope })}`, formData, {
    ...config,
    headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}

export function deleteVideo(
  id: number,
  scope: DataScope = 'PUBLIC',
  config: AxiosRequestConfig = withIdentity(),
): Promise<void> {
  return del<void>(`/api/b/video/${id}${toQuery({ scope })}`, config);
}
