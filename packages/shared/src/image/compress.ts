/**
 * 图片压缩结果。
 */
export interface CompressResult {
  /** 转码后的 JPEG Blob */
  blob: Blob;
  /** 原始宽度（像素）*/
  width: number;
  /** 原始高度（像素）*/
  height: number;
}

/**
 * 将图片文件转码为 JPEG，并压缩长边到 ≤maxSide。
 *
 * <p>这是 M2 上传链路的核心步骤（§6.5 第 ②③ 步）：
 * <ol>
 *   <li>createImageBitmap(file, { imageOrientation: 'from-image' }) — 解码并应用 EXIF 旋转</li>
 *   <li>canvas 绘制 → toBlob('image/jpeg', 0.85) — 统一输出 JPEG，HEIC 在这一步被转换</li>
 *   <li>长边压到 ≤2560（默认），保持纵横比</li>
 * </ol>
 *
 * <p><b>为什么需要这一步</b>：
 * <ul>
 *   <li>HEIC 浏览器不支持渲染，必须转 JPEG/WebP</li>
 *   <li>EXIF Orientation 在解码阶段就应用了，输出的 JPEG 像素本身已经是正的</li>
 *   <li>原图可能几 MB 甚至十几 MB，压缩后省流量省磁盘</li>
 * </ul>
 *
 * @param file 原始 File 对象
 * @param maxSide 长边最大像素数，默认 2560
 * @param quality JPEG 质量，默认 0.85
 * @returns 转码后的 Blob 和原始尺寸
 */
export async function compressImage(
  file: File,
  maxSide = 2560,
  quality = 0.85,
): Promise<CompressResult> {
  // 1. 解码图片（自动应用 EXIF Orientation 旋转）
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width: originalWidth, height: originalHeight } = bitmap;

  // 2. 计算缩放比例（长边压到 maxSide）
  let targetWidth = originalWidth;
  let targetHeight = originalHeight;
  const longSide = Math.max(originalWidth, originalHeight);

  if (longSide > maxSide) {
    const scale = maxSide / longSide;
    targetWidth = Math.round(originalWidth * scale);
    targetHeight = Math.round(originalHeight * scale);
  }

  // 3. canvas 绘制
  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法获取 canvas 上下文');
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close(); // 释放内存

  // 4. 导出为 JPEG
  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality,
  });

  return {
    blob,
    width: originalWidth,
    height: originalHeight,
  };
}
