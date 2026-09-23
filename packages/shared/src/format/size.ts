/**
 * 文件大小展示格式化。
 *
 * 与 date.ts 同一处定义的理由：B 端文件管理列表要显示大小，未来 C 端下载页也要，
 * 口径（1024 进制、保留几位）只需要说一次。
 */

/** 字节 → 人类可读：<1KB 用 B，<1MB 用 KB，其余 MB。空值给 '-'。 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) {
    return '-';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}
