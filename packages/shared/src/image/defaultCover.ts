/**
 * 菜品默认封面。
 *
 * 三个约束决定了它的形态：
 * - 两端共用同一张图。B 端列表页与 C 端点餐卡/详情/四处行内小图必须长成同一个样子，
 *   所以常量放在 shared，而不是两边各画一个占位。
 * - 不引入二进制文件。本仓库没有 assets/public 图片目录（首页卡片用的是 CSS 渐变），
 *   一张 SVG 写成 data URI 就够，省掉打包配置和一条网络请求。
 * - 各处 `<img>` 都是 `object-fit: cover`，且尺寸从 40px 行首小图到 531x236 的详情封面都有，
 *   所以画布取正方形、主体收在正中一条窄带里（y 约 98~211）：被裁成任何比例时图案都完整落在可视区内，
 *   最扁的那档（详情封面 2.25:1，可视带 y≈89~231）也不会把碗沿或热气切掉。
 */
const DEFAULT_RECIPE_COVER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="#f5f2ee"/>
  <g stroke="#d8c9b8" stroke-width="8" stroke-linecap="round" fill="none">
    <path d="M132 106c-8 12-3 20 3 28"/>
    <path d="M160 98c-8 12-3 22 3 30"/>
    <path d="M188 106c-8 12-3 20 3 28"/>
  </g>
  <path d="M100 142h120c0 32-27 56-60 56s-60-24-60-56z" fill="#e3d7c8"/>
  <path d="M100 142h120c0 7-1 12-2 17H102c-1-5-2-10-2-17z" fill="#d8c9b8"/>
  <rect x="142" y="202" width="36" height="9" rx="4.5" fill="#e3d7c8"/>
</svg>
`.trim();

/** 菜没配图（或图已被删）时各处 `<img>` 的 src。 */
export const DEFAULT_RECIPE_COVER = `data:image/svg+xml,${encodeURIComponent(
  DEFAULT_RECIPE_COVER_SVG,
)}`;

/**
 * 封面取值兜底：有图用图，没图用 {@link DEFAULT_RECIPE_COVER}。
 *
 * 订单明细的 `cover_url` 是下单时的快照（V315 起才有这一列），所以它可能是 null 的两种情况：
 * 点的时候这道菜就没配图，以及 V315 之前的存量单。这两类都走默认图，不给空白行。
 */
export function resolveRecipeCover(coverUrl?: string | null): string {
  return coverUrl || DEFAULT_RECIPE_COVER;
}
