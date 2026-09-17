/**
 * C 端 home 卡片数据。
 *
 * 一期是<b>前端静态常量</b>，不调后端（方案 §5.4）：
 * 用户明确说过卡片"里面内容也不做"，而一期开发重心在 B 端，
 * 所以后端 /api/c/home/entries 整个推迟到二期随 C 端内页一起做。
 *
 * 二期改成接口驱动时，把这个文件换成 useQuery 即可，页面组件不用动 ——
 * 所以这里的字段名刻意与方案 §5.5 存档的接口响应对齐（code / title / subTitle / coverUrl）。
 *
 * v5 新增了账号本模块，但这里**不加卡片**：口令只走 /api/b/vault/**，
 * C 端既没有对应接口也不该有（方案 §5.8）。这不是漏掉，是刻意的。
 */

export type EntryCode = 'ALBUM' | 'RECIPE';

export interface HomeEntry {
  code: EntryCode;
  title: string;
  subTitle: string;
  /** 一期用 CSS 渐变代替封面图，避免往仓库里塞二进制占位图 */
  gradient: string;
}

export const HOME_ENTRIES: HomeEntry[] = [
  {
    code: 'ALBUM',
    title: '家庭相册',
    subTitle: '记录每一个瞬间',
    gradient: 'linear-gradient(135deg, #5b7cfa 0%, #8e54e9 100%)',
  },
  {
    code: 'RECIPE',
    title: '家常菜谱',
    subTitle: '今天吃什么',
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ff5858 100%)',
  },
];

const TITLE_BY_CODE: Record<EntryCode, string> = {
  ALBUM: '家庭相册',
  RECIPE: '家常菜谱',
};

/** 占位页从 query 拿 code 映射标题；非法值兜底成通用文案 */
export function resolveEntryTitle(code: string | null): string {
  if (code === 'ALBUM' || code === 'RECIPE') {
    return TITLE_BY_CODE[code];
  }
  return '该功能';
}
