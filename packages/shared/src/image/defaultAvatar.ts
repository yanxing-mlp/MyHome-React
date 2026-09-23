/**
 * 账号默认头像。
 *
 * 与 {@link DEFAULT_RECIPE_COVER} 同一套做法：SVG 写成 data URI，不引入二进制文件、不多一条请求。
 *
 * 【画成什么样】人不分性别年龄，所以是一个纯剪影：圆底 + 头 + 肩。
 * 颜色刻意比 B 端主色（#2f54eb）淡两档，两端浅底上都不刺眼。
 *
 * 【为什么把圆底画进图里】B 端是 `<Avatar src>`（antd 自己裁成圆），C 端是 `<img>` 加
 * `border-radius: 50%`，两端的裁法不一样；底色画在 SVG 内层，被哪种裁法切成圆都是同一个样子。
 * 主体收在画布正中，四边留白，避免 24px 小图时人头贴边。
 */
const DEFAULT_USER_AVATAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="#eef1fa"/>
  <circle cx="160" cy="126" r="54" fill="#b5c0e0"/>
  <path d="M56 288c14-62 55-92 104-92s90 30 104 92z" fill="#b5c0e0"/>
</svg>
`.trim();

/** 账号没设头像时各处 `<img>` / `<Avatar>` 的 src。 */
export const DEFAULT_USER_AVATAR = `data:image/svg+xml,${encodeURIComponent(
  DEFAULT_USER_AVATAR_SVG,
)}`;

/**
 * 头像取值兜底：设过用设的，没设（或图已被删）用默认图。
 *
 * 后端只在 avatar_file_id 有值且文件还在时才返回 avatarUrl，所以 null 是常态而不是异常，
 * 不给空白圈——与菜品封面"没图也给一张"同一口径（见 defaultCover.ts）。
 */
export function resolveUserAvatar(avatarUrl?: string | null): string {
  return avatarUrl || DEFAULT_USER_AVATAR;
}
