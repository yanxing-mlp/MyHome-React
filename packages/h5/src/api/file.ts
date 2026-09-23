/**
 * C 端上传文件用的接口（后端 FileCController，`/api/c/file/upload`）。
 *
 * 目前只有相册上传入口用它。B 端走的是同一条服务方法的另一路径（`/api/b/file/upload`），
 * md5 秒传与缩略图那套只有一份实现。
 */

import { postMultipart } from '../utils/request';

/**
 * 对应 FileDTO。
 *
 * C 端只用 id（后面拿它去绑定相册分组），其余字段留在后端不管。
 * url / thumbUrl 是相对路径（/files/...），页面直接用 <img src> 吃它，dev 走 vite proxy。
 */
export interface UploadedFile {
  id: number;
  url: string;
  thumbUrl?: string;
}

/**
 * 相册图片的业务类型，取值对齐后端 FileUploadRequest 的 bizType 约定（B 端上传同一取值）。
 *
 * <p>历史数据里有 B 端早期传的小写 'album'：bizType 只是个统计标签，没有人按它查，所以不做清洗。
 */
const BIZ_TYPE_ALBUM_IMAGE = 'ALBUM_IMAGE';

/**
 * 上传一张已转码的图片，返回 file_object 的 ID。
 *
 * 只带 file + bizType 两个 part（后端 FileCController 就收这两个）。EXIF 不走上传接口：
 * file_object 表没有那三列，要落到 album_image 上就得用绑定接口（见 api/album.ts 的 AlbumImageBindItem）。
 */
export function uploadAlbumImage(jpeg: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', jpeg);
  form.append('bizType', BIZ_TYPE_ALBUM_IMAGE);
  return postMultipart<UploadedFile>('/api/c/file/upload', form);
}
