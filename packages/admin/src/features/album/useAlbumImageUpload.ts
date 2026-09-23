import { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import { extractExif, compressImage, toLocalDateTimeString } from '@family-home/shared/image';
import { getCurrentUserId } from '@family-home/shared/auth';
import { uploadImage, bindImagesToGroup, type AlbumImageBindItem, type AlbumGroupScope } from '../../api/album';
import { useAlbumKeys } from './useAlbumGroups';
import { useQueryClient } from '@tanstack/react-query';

/** 相册图片的业务类型，取值对齐后端注释，C 端上传用的也是这一个 */
const BIZ_TYPE_ALBUM_IMAGE = 'ALBUM_IMAGE';

/**
 * 相册图片上传 Hook。
 *
 * 流程：
 * 1. 前端 exifr 提取 GPS/拍摄时间（**必须在转码前**，canvas 出来的 JPEG 不带 EXIF）
 * 2. canvas 转 JPEG + 压缩长边 ≤2560
 * 3. 逐张上传到后端，只拿 fileId
 * 4. 批量绑定到选中的分组，EXIF 和 city 一起挂在每个绑定项上
 *
 * <p>第 3、4 步的分工是踩过坑定下来的：上传接口只收 `file` + `bizType` 两个 part（EXIF 一律不进文件域，
 * `file_object` 没那几列），真正写这几列的是绑定那一步的 `album_image`。原先把 EXIF 打包成一个
 * 叫 `metadata` 的 part 发出去，服务端不认这个名字，结果 B 端传的图拍摄时间一直是 NULL。
 *
 * <p>分组是必传的：只走第 3 步不走第 4 步的话，文件躺在 `file_object` 里，`album_image` 一行都没有，
 * B 端图片列表和 C 端相册（连"其他"卡片）都查不到它，等于上传了一张谁也看不见的图。
 */
export function useAlbumImageUpload(groupIds: number[], scope: AlbumGroupScope) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const keys = useAlbumKeys(scope);
  const active = useRef(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const ensureActive = () => {
    if (!active.current || getCurrentUserId() !== String(keys.root[2])) {
      throw new Error('上传已取消');
    }
  };

  /**
   * 上传多张图片并绑定到选中的分组
   */
  const uploadFiles = async (files: File[], city?: string) => {
    if (files.length === 0 || groupIds.length === 0 || uploading) return;
    ensureActive();

    setUploading(true);
    const results: AlbumImageBindItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        ensureActive();
        const file = files[i];
        message.loading(`正在处理第 ${i + 1}/${files.length} 张图片...`, 0);

        // 1. 提取 EXIF（必须在转码之前）
        const exif = await extractExif(file);

        // 2. 压缩转 JPEG
        const compressed = await compressImage(file);

        // 3. 上传到后端（只传文件本身，EXIF 留到第 4 步随绑定项一起写 album_image）
        const jpegFile = new File([compressed.blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
          type: 'image/jpeg',
        });

        ensureActive();
        const uploadResp = await uploadImage(jpegFile, BIZ_TYPE_ALBUM_IMAGE);
        ensureActive();
        results.push({
          fileId: uploadResp.id,
          city, // 使用用户选择的城市
          lng: exif.longitude,
          lat: exif.latitude,
          shootTime: toLocalDateTimeString(exif.shootTime),
        });
      }

      message.destroy();

      // 4. 这批图绑到选中的每个分组上（重复的会被跳过，要数出来告诉用户）
      let skipped = 0;
      for (const groupId of groupIds) {
        ensureActive();
        const result = await bindImagesToGroup(groupId, { items: results }, scope);
        skipped += result.skippedDuplicates.length;
      }
      ensureActive();
      message.success(
        `成功上传 ${results.length} 张图片到 ${groupIds.length} 个分组${
          skipped > 0 ? `，${skipped} 张重复跳过` : ''
        }`,
      );
    } catch (error) {
      message.destroy();
      if (active.current) message.error(error instanceof Error ? error.message : '上传失败');
      throw error;
    } finally {
      // 部分分组已绑定后失败也需刷新；前缀保留此次上传原本的 scope 和账号。
      void queryClient.invalidateQueries({ queryKey: keys.root });
      if (active.current) setUploading(false);
    }
  };

  return { uploadFiles, uploading };
}
