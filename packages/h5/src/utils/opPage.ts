/**
 * C 端「当前所在页面」中文名，供操作审计的 {@code X-Op-Page} 头带上（方案 v45）。
 *
 * 与 admin 的 lib/opPage.ts 同一手法，只是路由表换成 C 端那套（basename '/'）。
 * 读 {@code window.location.pathname} 逐段匹配，带参路由用通配段；匹配不到退回原始路径。
 */
import { getAuthToken } from '@family-home/shared/auth';

const ROUTE_NAMES: Array<[string, string]> = [
  ['/album/personal/:id', '私人相册·详情'],
  ['/album/personal', '私人相册'],
  ['/album/:id', '相册·详情'],
  ['/album', '相册'],
  ['/video/personal/:id', '私人视频·详情'],
  ['/video/personal', '私人视频'],
  ['/video/:id', '视频·详情'],
  ['/video', '视频'],
  ['/vault/personal', '私人密码本'],
  ['/vault', '密码本'],
  ['/recipe/order/confirm', '确认订单'],
  ['/recipe/order', '点餐'],
  ['/recipe/orders/:id', '订单详情'],
  ['/recipe/orders', '我的订单'],
  ['/login', '登录'],
];

function matches(patternSegs: string[], pathSegs: string[]): boolean {
  if (patternSegs.length !== pathSegs.length) return false;
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i];
    if (p.startsWith(':')) continue;
    if (p !== pathSegs[i]) return false;
  }
  return true;
}

export function currentOpPageName(): string {
  // C 端未登录时无论路由为何，渲染的都是登录页（见 App.tsx）——此时页面名就是「登录」。
  if (!getAuthToken()) return '登录';
  let path = window.location.pathname;
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '' || path === '/') return '首页';

  const pathSegs = path.split('/').filter(Boolean);
  for (const [pattern, name] of ROUTE_NAMES) {
    const patternSegs = pattern.split('/').filter(Boolean);
    if (matches(patternSegs, pathSegs)) return name;
  }
  return path;
}
