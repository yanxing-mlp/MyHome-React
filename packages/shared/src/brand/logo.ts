/**
 * 跨端品牌标识（logo）。
 *
 * 设计口径，三条：
 * - **一个图形，两端共用**。B 端侧栏/移动顶栏与 C 端首页必须是同一个东西，
 *   所以常量放在 shared（与 `image/defaultCover.ts` 同一套做法）：一张 SVG 写成 data URI，
 *   不往仓库塞二进制、不建 public 目录、不多一条网络请求。
 * - **配色就是这款产品本身的颜色**。三个色标全部取自现有主题，不新造颜色：
 *   `#2f54eb` 是 B 端 antd 的 colorPrimary，`#ff5858` 是 C 端主色（订单状态色、菜谱卡渐变末色），
 *   中间那颗 `#8e54e9` 取自相册卡渐变。蓝→紫→珊瑚一条 135° 渐变，正好是"B 端 + C 端"合成一个家。
 *   插中间这一档是为了避免蓝直接渐变到珊瑚时中段发灰。
 * - **16px 要能认**。图形只有两层：圆角徽牌 + 白色房子，房子正中一颗心形门透出底色。
 *   不画烟囱、不画窗、不用描边线稿——那些在 favicon 尺寸下会糊成一团。
 *   心形靠"挖"在房子里（用底色填），缩到 16px 时退化成白房子里一个色点，房子轮廓本身仍然读得出来。
 *
 * 文字部分（"家庭 Home"）刻意**不做成 SVG**：两端原本就有 HTML 文本，交给系统字体渲染
 * 才能和页面里其他中文一致、也才跟着暗色/字号变化；SVG 里写 `<text>` 反而锁死字体。
 * 所以这里只导出图形，字标由各处自己排在旁边。
 */

/** SVG 源码（未编码）。渐变 id 带 fhLogo 前缀，避免将来内联到页面时和其他 defs 撞 id。 */
const FH_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="fhLogoGradient" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="58" y2="58">
      <stop offset="0" stop-color="#2f54eb"/>
      <stop offset="0.55" stop-color="#8e54e9"/>
      <stop offset="1" stop-color="#ff5858"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="19" fill="url(#fhLogoGradient)"/>
  <g fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round">
    <path d="M32 16L54 33H10Z"/>
    <rect x="15" y="32" width="34" height="21" rx="5" stroke="none"/>
  </g>
  <path d="M32 48.5C28.2 45.1 25.8 43 25.8 40.3 25.8 38.1 27.5 36.5 29.6 36.5 30.8 36.5 31.7 37 32 37.7 32.3 37 33.2 36.5 34.4 36.5 36.5 36.5 38.2 38.1 38.2 40.3 38.2 43 35.8 45.1 32 48.5Z" fill="url(#fhLogoGradient)"/>
</svg>
`.trim();

/** 各处 `<img>` 的 src。正方形画布，靠 CSS 定尺寸，任何倍率都清晰。 */
export const FH_LOGO = `data:image/svg+xml,${encodeURIComponent(FH_LOGO_SVG)}`;

/** 产品名，也是 logo 的无障碍名与 favicon 兜底标题。 */
export const FH_LOGO_ALT = '家庭 Home';

/**
 * 把浏览器标签页图标（favicon）设成同一份 logo，两端 main.tsx 各调一次。
 *
 * 为什么不在 index.html 里写 `<link rel="icon">`：那份 SVG 的源在这里，
 * 静态 HTML 里再写一遍就是第二份副本（或者要建 public 目录塞二进制），
 * 以后改图形得同步两处。代价是 JS 跑起来之前那一瞬标签页是浏览器默认图标——
 * 本地 B 端后台与手机上的 C 端 H5，这一瞬都可以接受。
 */
export function applyFavicon(): void {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = FH_LOGO;
  document.head.appendChild(link);
}
