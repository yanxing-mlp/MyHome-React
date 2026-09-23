import type { CSSProperties } from 'react';
import { useUserOptions } from '../features/user/useUsers';

/** 账号被删掉之后，历史数据上那一格显示什么。creator_id 不跟着改（见后端包注释），所以总要有人接这个值 */
export const DELETED_USER_TEXT = '已删除账号';

const DEFAULT_STYLE: CSSProperties = { color: '#8c8c8c', fontSize: 12 };

/**
 * "添加人 / 下单人"这三个字的实际渲染：把 creator_id 换成一个昵称。
 *
 * 七个页面（菜谱列表、菜品分类、点单列表、文件管理、密码本、相册分组、相册图片）都只用这一个组件，
 * 于是"查不到 id 怎么显示"这件事全库只有一份答案。
 *
 * 【没值就不渲染】id 为 null 时返回 null，不给"—"占位。
 * 存量数据已经由 V501 洗成大宝，正常不会有 null；真出现就是某条写入路径漏填，
 * 这时候画一个占位符反而把问题藏起来。
 *
 * 【字典还没到也不渲染】宁可空半秒，也不要在加载期间先闪一次"已删除账号"。
 *
 * @param label 名字前面的灰字标签（「添加人」）。表格列有表头不用给；窄屏卡片没有表头，
 *              必须给，否则那串名字会被读成"这是另一个标题"。与 `TimeText` 的 label 同一口径。
 */
export function CreatorText({
  id,
  label,
  style,
}: {
  id?: number | null;
  label?: string;
  style?: CSSProperties;
}) {
  const { data } = useUserOptions();
  if (id == null || !data) return null;
  const name = data.find((user) => user.id === id)?.name;
  const text = name ?? DELETED_USER_TEXT;
  return (
    <span style={{ ...DEFAULT_STYLE, ...style }}>{label ? `${label} ${text}` : text}</span>
  );
}
