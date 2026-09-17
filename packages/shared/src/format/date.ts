/**
 * 时间展示格式化。
 *
 * 放在 shared 而不是各端自己写：后端所有时间字段都是 ISO-8601 字符串
 * （LocalDateTime 经 Jackson 序列化，如 `2026-09-17T17:26:57.948`，**不带时区**）。
 * B 端表格、B 端弹窗、C 端二期都要展示它，格式必须一处定。
 *
 * 不用 dayjs：shared 不引运行时依赖，h5 也要能复用（h5 现在连 antd 都没装）。
 */

/** 后端 ISO 字符串 → 'YYYY-MM-DD HH:mm'。空值给 '-'，解析失败原样返回。 */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseIso(value);
  if (!date) {
    return value ?? '-';
  }
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 后端 ISO 字符串 → 'YYYY-MM-DD'。 */
export function formatDate(value: string | null | undefined): string {
  const date = parseIso(value);
  if (!date) {
    return value ?? '-';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * 只认后端那种「本地时间、无时区后缀」的 ISO 串。
 *
 * 注意 `new Date('2026-09-17T17:26:57')` 按 ES 规范是以**浏览器本地时区**解释的，
 * 而后端存的是服务器本地时间。家里这台机器和浏览器同为 Asia/Shanghai 时没问题；
 * 真要跨时区展示，得让后端改成 OffsetDateTime，而不是在这里补时区。
 */
function parseIso(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
