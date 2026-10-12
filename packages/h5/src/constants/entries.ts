/**
 * C 端首页九宫格的静态入口；只展示已有功能，不补空白占位。
 * 渐变用于图标底色，路由和图形由 HomePage 按 code 映射。
 *
 * 入口按「域」收敛成两套（家庭 / 个人），首页只显示当前域那一档（见 lib/domain.ts）：
 * - 家庭域：家常菜谱 + 相册 + 视频 + 密码本（4 个）；
 * - 个人域：相册 + 视频 + 密码本（3 个）。菜谱是家庭共享、没有个人版，只在家庭域出现（与 B 端同一口径）。
 * 相册/视频/密码本各只有一个入口，点进去是家庭还是私人由当前域决定——不再像过去那样把「家庭相册 / 私人相册」
 * 并列成两个入口（同一件事出现两遍）。标题因此去掉「家庭 / 私人」前缀，域牌已表达当前在哪一档。
 * 底层仍保留 7 个 EntryCode（相册/视频/密码本各有公私两个 code），图标与路由按 code 精确映射，不会串。
 */
export type EntryCode =
  | 'ALBUM'
  | 'PERSONAL_ALBUM'
  | 'RECIPE'
  | 'VIDEO'
  | 'PERSONAL_VIDEO'
  | 'VAULT'
  | 'PERSONAL_VAULT';

export interface HomeEntry {
  code: EntryCode;
  title: string;
  gradient: string;
}

/** 家庭域入口。 */
export const FAMILY_ENTRIES: HomeEntry[] = [
  {
    code: 'RECIPE',
    title: '家常菜谱',
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ff5858 100%)',
  },
  {
    code: 'ALBUM',
    title: '相册',
    gradient: 'linear-gradient(135deg, #5b7cfa 0%, #8e54e9 100%)',
  },
  {
    code: 'VIDEO',
    title: '视频',
    gradient: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)',
  },
  {
    code: 'VAULT',
    title: '密码本',
    gradient: 'linear-gradient(135deg, #b8860b 0%, #f4c430 100%)',
  },
];

/** 个人域入口（菜谱无个人版，故只有相册/视频/密码本）。 */
export const PERSONAL_ENTRIES: HomeEntry[] = [
  {
    code: 'PERSONAL_ALBUM',
    title: '相册',
    gradient: 'linear-gradient(135deg, #229b91 0%, #4175b5 100%)',
  },
  {
    code: 'PERSONAL_VIDEO',
    title: '视频',
    gradient: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
  },
  {
    code: 'PERSONAL_VAULT',
    title: '密码本',
    gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
  },
];
