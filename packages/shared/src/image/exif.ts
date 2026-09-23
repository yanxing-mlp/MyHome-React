import exifr from 'exifr';

/**
 * EXIF 元数据。
 *
 * <p>前端在 canvas 转码**之前**调用 {@link extractExif} 提取，因为转码后的 JPEG 不带任何 EXIF（§6.6）。
 */
export interface ExifData {
  /** GPS 纬度 */
  latitude?: number;
  /** GPS 经度 */
  longitude?: number;
  /**
   * 拍摄时间。exifr 对 `DateTimeOriginal` / `CreateDate` 返回的是 **Date**，
   * 个别来源（手写 EXIF、别的解析路径）可能给 "2024:01:15 14:30:00" 这种字符串，所以两种都留口子。
   * 要发给后端请先过一遍 {@link toLocalDateTimeString}。
   */
  shootTime?: Date | string;
}

/**
 * 从原始图片文件提取 EXIF 元数据。
 *
 * <p>只取 GPS 和拍摄时间。**必须在 canvas 转码之前调用**（转码后的 JPEG 一张 EXIF 都不剩，§6.6）。
 * 这两项的落库位置是 `album_image`，所以调用方要把它们放进**绑定请求的每一项**里，
 * 而不是塞进上传的 multipart：`file_object` 没有 lng/lat/shoot_time 列，
 * `FileController.upload` 上那三个 `@RequestPart` 收进去之后下层根本不读（方案 §6.5"实现实况"）。
 * Orientation 不需要提取：createImageBitmap 的 imageOrientation 选项会在解码阶段自动应用旋转。
 *
 * @param file 原始 File 对象（HEIC / JPEG 等）
 * @returns EXIF 数据；解析失败时返回空对象
 */
export async function extractExif(file: File): Promise<ExifData> {
  try {
    const data = await exifr.parse(file, {
      gps: true,     // 提取 GPS
      exif: true,    // 提取 DateTimeOriginal
    });

    if (!data) {
      return {};
    }

    const result: ExifData = {};

    // GPS：exifr 会把 GPS 解析成 latitude/longitude
    if (data.latitude != null && data.longitude != null) {
      result.latitude = data.latitude;
      result.longitude = data.longitude;
    }

    // 拍摄时间：DateTimeOriginal 或 CreateDate
    result.shootTime = data.DateTimeOriginal ?? data.CreateDate ?? undefined;

    return result;
  } catch (e) {
    // exifr 解析失败不影响主流程，lng/lat/拍摄时间留空即可（后端不会补读，方案 §6.6 那条 fallback 没实现）
    console.warn('EXIF 解析失败:', e);
    return {};
  }
}

/**
 * EXIF 拍摄时间 → 后端 `LocalDateTime` 认的 "YYYY-MM-DDTHH:mm:ss"。
 *
 * <p>两头都不能省：
 * <ul>
 *   <li>直接把 Date 丢进 JSON 会变成带 Z 的 ISO 串，后端字段是 LocalDateTime，带时区它不认；
 *       按设备本地时区展开成不带时区的字面量，才是"这张照片下午 3 点拍的"那个意思；</li>
 *   <li>EXIF 里年月日之间用冒号的写法（"2024:01:15 14:30:00"）`new Date()` 解不出来，先换成短横线。</li>
 * </ul>
 *
 * @returns 格式化好的字面量；传空或解不出时间就是 undefined（调用方直接不写这个字段）
 */
export function toLocalDateTimeString(value: Date | string | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  const raw =
    value instanceof Date
      ? value
      : new Date(String(value).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
  if (Number.isNaN(raw.getTime())) {
    return undefined;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}T${pad(
    raw.getHours(),
  )}:${pad(raw.getMinutes())}:${pad(raw.getSeconds())}`;
}
