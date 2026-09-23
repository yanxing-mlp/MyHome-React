/**
 * C 端首页九宫格的静态入口；只展示已有功能，不补空白占位。
 * 渐变用于图标底色，路由和图形由 HomePage 按 code 映射。
 * 相册 / 视频都分家庭与私人两档（私人只看当前账号自己的），与后端 FAMILY/PERSONAL、PUBLIC/PRIVATE 分区对齐；
 * 视频在 C 端只读（看/播放），上传与删除仍只在 B 端"视频管理"。密码本只走 B 端，这里不添加入口。
 */
export type EntryCode = 'ALBUM' | 'PERSONAL_ALBUM' | 'RECIPE' | 'VIDEO' | 'PERSONAL_VIDEO';

export interface HomeEntry {
  code: EntryCode;
  title: string;
  gradient: string;
}

export const HOME_ENTRIES: HomeEntry[] = [
  {
    code: 'ALBUM',
    title: '家庭相册',
    gradient: 'linear-gradient(135deg, #5b7cfa 0%, #8e54e9 100%)',
  },
  {
    code: 'PERSONAL_ALBUM',
    title: '私人相册',
    gradient: 'linear-gradient(135deg, #229b91 0%, #4175b5 100%)',
  },
  {
    code: 'RECIPE',
    title: '家常菜谱',
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ff5858 100%)',
  },
  {
    code: 'VIDEO',
    title: '家庭视频',
    gradient: 'linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%)',
  },
  {
    code: 'PERSONAL_VIDEO',
    title: '私人视频',
    gradient: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
  },
];
