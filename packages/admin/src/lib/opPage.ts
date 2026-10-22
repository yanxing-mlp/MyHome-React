/**
 * 把「当前所在页面」还原成中文名，供操作审计的 {@code X-Op-Page} 头带上（方案 v45）。
 *
 * 后端天然只知道「调了哪个接口」，「在哪个页面点的」只有前端知道，所以由前端在发请求时把当前路由
 * 翻成中文页面名带上去。这里读 {@code window.location.pathname}（请求发起那一刻的真实路由），
 * 剥掉 {@code /admin} basename 后按路由表逐段匹配；带参路由（:groupId / :id）用通配段匹配。
 * 匹配不到就退回原始路径，宁可显示英文路径也不留空。
 */

/** 路由模式 → 中文页面名。顺序敏感：更具体的（带子段）排在更宽泛的前面。 */
const ROUTE_NAMES: Array<[string, string]> = [
  ['/home', '首页'],
  ['/album/personal/groups', '个人相册·分组'],
  ['/album/personal/images', '个人相册·全部图片'],
  ['/album/personal/distribution', '个人相册·城市分布'],
  ['/album/personal/:id', '个人相册·图片详情'],
  ['/album/groups', '相册·分组'],
  ['/album/images', '相册·全部图片'],
  ['/album/distribution', '相册·城市分布'],
  ['/album/:id', '相册·图片详情'],
  ['/recipe/categories', '菜谱·分类管理'],
  ['/recipe/practices', '菜谱·做法管理'],
  ['/recipe/orders', '菜谱·点单列表'],
  ['/recipe/statistics', '菜谱·点单统计'],
  ['/recipe/new', '菜谱·新建菜品'],
  ['/recipe/:id/edit', '菜谱·编辑菜品'],
  ['/recipe', '菜谱·菜品'],
  ['/file/public/groups', '文件·公共分组'],
  ['/file/public/group/:id', '文件·公共分组详情'],
  ['/file/public', '文件·公共'],
  ['/file/private/groups', '文件·个人分组'],
  ['/file/private/group/:id', '文件·个人分组详情'],
  ['/file/private', '文件·个人'],
  ['/video/public/groups', '视频·公共分组'],
  ['/video/public/group/:id', '视频·公共分组详情'],
  ['/video/public', '视频·公共'],
  ['/video/private/groups', '视频·个人分组'],
  ['/video/private/group/:id', '视频·个人分组详情'],
  ['/video/private', '视频·个人'],
  ['/vault/public', '密码本·公共'],
  ['/vault/private', '密码本·个人'],
  ['/user', '账号管理'],
  ['/storage', '目录管理'],
  ['/change-log', '变更记录'],
  ['/deploy', '部署管理'],
  ['/logs', '系统日志'],
  ['/operation-logs', '操作记录'],
  ['/knowledge', '知识库'],
  ['/server-repo', '后端代码'],
  ['/web-repo', '前端代码'],
  ['/database', '数据库'],
  ['/profile', '个人中心'],
];

/** 逐段匹配：模式段以 ':' 开头视为通配（匹配任意非空段）。 */
function matches(patternSegs: string[], pathSegs: string[]): boolean {
  if (patternSegs.length !== pathSegs.length) return false;
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i];
    if (p.startsWith(':')) continue;
    if (p !== pathSegs[i]) return false;
  }
  return true;
}

/** 当前页面中文名（已剥 basename）；匹配不到退回原始路径。 */
export function currentOpPageName(): string {
  let path = window.location.pathname;
  if (path.startsWith('/admin')) path = path.slice('/admin'.length);
  if (!path.startsWith('/')) path = '/' + path;
  // 去掉结尾斜杠（根路径 '/' 除外），与路由表对齐
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '' || path === '/') return '首页';

  const pathSegs = path.split('/').filter(Boolean);
  for (const [pattern, name] of ROUTE_NAMES) {
    const patternSegs = pattern.split('/').filter(Boolean);
    if (matches(patternSegs, pathSegs)) return name;
  }
  return path;
}
