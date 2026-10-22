/**
 * 角色权限矩阵接口（后端 RoleController，`/api/b/role`）。
 *
 * 两条：读整张矩阵（GET）、保存某个角色的完整勾选（PUT）。
 *
 * 【读要 role.access，写只有超管】读接口服务端判 `requirePermission(ROLE_ACCESS)`——能进「角色管理」页就能读；
 * 写接口服务端是 `requireSuperAdmin()` 硬门禁，<b>不进矩阵</b>：普通管理员即便被勾上 role.access 能看这张表，
 * 也保存不了，否则他就能给自己勾上 user.access/role.access 自我提权，矩阵形同虚设。
 * 所以前端"保存"按钮只对超管可用，其余角色这一页是只读的（页面自己再判一次，见 RoleManagePage）。
 *
 * 【行由后端下发，前端不另存一份目录】矩阵的"行"（权限段 + 中文标签）来自后端 `PermissionCatalog.GROUPS`，
 * 随 GET 返回；前端照着渲染，不在 shared 里再抄一份 GROUPS，避免两处漂移（shared/auth 只镜像"码"用于判权限）。
 *
 * 【超管那一列不落库】grants 只含 ADMIN / MEMBER 两档；超管恒全选、由后端短路，前端把它渲染成"全选且禁用"，
 * 不从 grants 里读、也不往保存请求里写。
 */
import { get, put } from '../lib/http';

/** 一个权限项：码 + 中文标签（对应后端 PermissionCatalog.Perm）。 */
export interface PermItem {
  code: string;
  label: string;
}

/** 矩阵里的一"段"：业务模块段两档（查看/管理），系统后台段每页一项（访问）。对应后端 PermissionCatalog.Group。 */
export interface PermGroup {
  key: string;
  label: string;
  perms: PermItem[];
}

/**
 * 整张矩阵（对应后端 RolePermissionService.MatrixVO）。
 *
 * `grants` 是"角色 → 该角色已勾选的权限码数组"，只含可编辑的 ADMIN / MEMBER 两档；
 * SUPER_ADMIN 不在里面（恒全选，前端自己画禁用态）。
 */
export interface RoleMatrix {
  groups: PermGroup[];
  grants: Record<string, string[]>;
}

/** 读整张矩阵。要 role.access。 */
export function fetchRoleMatrix(): Promise<RoleMatrix> {
  return get<RoleMatrix>('/api/b/role/matrix');
}

/**
 * 保存某个可编辑角色的完整勾选（整批删旧插新）。只有超管能调。
 *
 * `codes` 是"这个角色现在完整的权限清单"——不是增量：前端把该列所有勾中的码收集起来一次提交，
 * 空数组 = 把这个角色的权限全清空。角色只认 ADMIN / MEMBER（超管不可编辑，后端会 400）。
 */
export function saveRoleMatrix(role: string, codes: string[]): Promise<void> {
  return put<void>('/api/b/role/matrix', { role, codes });
}
