import type { CurrentUser } from './currentUser';

/**
 * 前端权限口径：镜像后端 `PermissionCatalog`（fh-common）与三档角色常量。
 *
 * 【为什么是镜像而不是各端各写一份】
 * 权限码是后端 RBAC 的"行"，写死在 `PermissionCatalog` 里；前端菜单可见性、路由 403、
 * 业务页只读禁用都要拿这些码去比对。两端各存一份必然会漂移，所以这里逐字对齐后端常量，
 * 改后端目录 = 改这里（后端类注释里也点了这一条）。
 *
 * 【前端只用到"码"，不用到"分组/标签"】
 * 角色管理页那张可编辑矩阵的"行"（分组 + 中文标签）由后端 `GET /api/b/role/matrix` 现值返回，
 * 前端照着渲染即可，不在这里再抄一份 GROUPS——否则矩阵行就有了两个出处。
 * 这里只保留"判权限要用的码常量"与"展示要用的角色中文名"。
 *
 * 【真正的强制在后端】
 * 藏菜单、置灰按钮只是体验；后端逐个写接口判 `.manage`、逐个系统后台接口判 `.access`
 * （超管短路全通过）。前端 `can()` 返回 true 也绕不过后端那道，返回 false 只是不给入口。
 */

/** 三档角色，取值与后端 `CurrentUserHolder.ROLE_*` 逐字对齐。 */
export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

/** 角色中文名（账号管理页标签、角色管理页列头共用）。 */
export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '普通管理员',
  MEMBER: '普通成员',
};

/** 业务模块：查看 + 管理（与后端 `PermissionCatalog` 的业务码逐字一致）。 */
export const PERMISSION = {
  RECIPE_VIEW: 'recipe.view',
  RECIPE_MANAGE: 'recipe.manage',
  ORDER_VIEW: 'order.view',
  ORDER_MANAGE: 'order.manage',
  ALBUM_VIEW: 'album.view',
  ALBUM_MANAGE: 'album.manage',
  FILE_VIEW: 'file.view',
  FILE_MANAGE: 'file.manage',
  VIDEO_VIEW: 'video.view',
  VIDEO_MANAGE: 'video.manage',
  VAULT_VIEW: 'vault.view',
  VAULT_MANAGE: 'vault.manage',
  // 系统后台：单一 access
  USER_ACCESS: 'user.access',
  ROLE_ACCESS: 'role.access',
  STORAGE_ACCESS: 'storage.access',
  CHANGELOG_ACCESS: 'changelog.access',
  DEPLOY_ACCESS: 'deploy.access',
  LOGS_ACCESS: 'logs.access',
  OPLOG_ACCESS: 'oplog.access',
  KNOWLEDGE_ACCESS: 'knowledge.access',
  SERVER_REPO_ACCESS: 'server-repo.access',
  WEB_REPO_ACCESS: 'web-repo.access',
  DATABASE_ACCESS: 'database.access',
} as const;

export type PermissionCode = (typeof PERMISSION)[keyof typeof PERMISSION];

/** 是不是超级管理员。超管拥有全部权限，且是唯一能改角色与改权限矩阵的人。 */
export function isSuperAdmin(user: CurrentUser | null): boolean {
  return user?.role === ROLE.SUPER_ADMIN;
}

/** 至少是普通管理员（含超管）。用于"是不是管理岗"这类粗判，不替代 {@link can}。 */
export function isManager(user: CurrentUser | null): boolean {
  return user?.role === ROLE.SUPER_ADMIN || user?.role === ROLE.ADMIN;
}

/**
 * 这个用户有没有某个权限码。超管短路为"全都有"（与后端 `CurrentUser.hasPermission` 同口径，
 * 防自锁：矩阵里超管那一列不落库、恒全选）。其余角色看本机缓存里那一格 `permissions`。
 *
 * `permissions` 由登录 / `/me` 返回、随展示对象整格覆盖；改了矩阵后当事人下次请求（refreshMe）即刷新。
 */
export function can(user: CurrentUser | null, code: string): boolean {
  if (!user) return false;
  if (user.role === ROLE.SUPER_ADMIN) return true;
  return user.permissions.includes(code);
}
