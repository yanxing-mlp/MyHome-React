/**
 * 上传前的图片处理：**保留原图，不做压缩**。
 *
 * <p>后端只收 jpeg/png/webp/gif 四种 MIME，且把上传字节**原样落盘**——缩略图是另存的
 * 第二份物理文件（长边 480），只用于列表/封面展示；预览与下载走的都是原图那条 URL。
 * 所以画质只在"前端上传前"这一步可能丢失，本函数的职责就是尽量不丢：
 *
 * <ul>
 *   <li><b>已经是 jpeg/png/webp/gif</b>：原封不动返回原始 {@link File}——零转码、零降采样、
 *       零重编码，EXIF（含 Orientation、拍摄时间、GPS）也原样保留。这是绝大多数图片的路径。</li>
 *   <li><b>HEIC 等浏览器不能渲染、后端也不收的格式</b>：只能转成 JPEG 才能上传。此时按
 *       <b>原始分辨率 + 最高质量（1.0）</b>转码，不再把长边压到 2560、也不用 0.85 质量。
 *       转码本身不可避免是有损的（HEIC→JPEG），但这已是不牺牲尺寸前提下的最好结果。</li>
 * </ul>
 *
 * <p>EXIF Orientation 只在转码那条路需要显式应用（{@code createImageBitmap} 的
 * {@code imageOrientation: 'from-image'}）；原图直传那条路不碰像素，浏览器渲染 `<img>`
 * 与后端 Thumbnailator 生成缩略图都会各自读取并应用 EXIF 方向，所以展示仍然是正的。
 *
 * @param file 用户选中的原始图片文件
 * @returns 直接可上传的 File：要么就是原始 file 本身，要么是转码后的全尺寸 JPEG
 */

/** 后端 MIME 白名单命中的格式一律原图直传（与 FileFacadeImpl.ALLOWED_MIME_TYPES 对齐）。 */
const UPLOADABLE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function prepareImageForUpload(file: File): Promise<File> {
  // 1. 白名单内的格式：原样直传，一个字节都不改。
  if (UPLOADABLE_MIME_TYPES.has(file.type)) {
    return file;
  }

  // 2. HEIC / 其他不支持的格式：解码 → 原始尺寸 canvas → 最高质量 JPEG（不缩放）。
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('无法获取 canvas 上下文');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close(); // 释放内存

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 1 });
  const baseName = file.name.includes('.') ? file.name.replace(/\.[^.]+$/, '') : file.name;
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
