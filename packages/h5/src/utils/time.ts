/**
 * 后端 LocalDateTime 序列化成 ISO 串（"2026-09-18T13:35:05.097"），
 * 转成展示文案。解析不出来就原样返回，至少不阻塞页面。
 */
export function formatOrderTime(iso: string, withYear = false): string {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!matched) return iso;
  const [, year, month, day, hour, minute] = matched;
  return withYear
    ? `${year}-${month}-${day} ${hour}:${minute}`
    : `${month}-${day} ${hour}:${minute}`;
}
