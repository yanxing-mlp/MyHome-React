/**
 * C 端"看视频"用的接口（后端 VideoCController，`/api/c/video`）。
 *
 * 只读：列表 + 播放流。C 端不上传、不删除（那是 B 端"视频管理"的事）。
 * 与相册 C 端同一口径：路径与返回形状按 C 端裁剪，落库/查询仍与 B 端共用同一套 service。
 * scope 默认 PUBLIC（家庭视频，全家可见）；PRIVATE 只返回当前账号自己的私人视频。
 * 请求封装见 utils/request.ts。
 */

import { getJson } from '../utils/request';

export type VideoScope = 'PUBLIC' | 'PRIVATE';

/**
 * 对应 VideoClientVO：C 端只下发这几列（添加人/分区/属主/mime 都不给），所以这里也不用挑字段。
 *
 * playUrl 是服务端根相对的播放流地址 `/api/c/video/{id}/stream?ticket=...`，带一枚短时签名票据
 * （6 小时过期，过期后回列表页重进即换新票据）。h5 的 base 是 '/'，Vite/nginx 都把 '/api' 转到后端，
 * 所以直接塞进 `<video src>` 即可——不用像 admin 那样再拼一层 base 前缀（admin 的 base 是 '/admin/'）。
 */
export interface VideoItem {
  id: number;
  /** 上传时的原始文件名，含扩展名 */
  name: string;
  /** 扩展名大写，如 MP4 / WEBM */
  fileType: string;
  /** 字节，用 shared 的 formatFileSize 展示 */
  fileSize: number;
  /** 播放流地址（根相对，带签名票据） */
  playUrl: string;
}

/**
 * 视频分组卡片（两级展示的第一级），对应 VideoGroupClientVO。
 * C 端只读，只给名字 + 支数，不含内部字段（分区/属主/排序都不下发）。
 */
export interface VideoGroup {
  groupId: number;
  name: string;
  /** 该分组下的视频支数（同一支视频可属多个分组，各分组分别计数） */
  videoCount: number;
}

/**
 * 列一个分区的视频分组卡片。分组没有上下架，所以就是当前分区的全部分组。
 * 点进某组再走 listVideos(scope, groupId)。
 */
export function listVideoGroups(scope: VideoScope = 'PUBLIC'): Promise<VideoGroup[]> {
  return getJson<VideoGroup[]>(`/api/c/video/groups?scope=${scope}`);
}

/**
 * 列一个分区的视频，最近上传在前，整表返回不分页（家庭量级几十支）。
 *
 * groupId 不传 = 全部视频（含未分组）；传了 = 只看这个分组下的。
 * PRIVATE 的属主由服务端按登录令牌判定，前端不传、也不能传别人的 id；
 * 跨属主的私人视频在这一条上根本查不出来（与相册 PERSONAL 同一口径）。
 */
export function listVideos(scope: VideoScope = 'PUBLIC', groupId?: number): Promise<VideoItem[]> {
  const groupQuery = groupId != null ? `&groupId=${groupId}` : '';
  return getJson<VideoItem[]>(`/api/c/video?scope=${scope}${groupQuery}`);
}
