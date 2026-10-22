import { Select } from 'antd';
import { ROLE, ROLE_LABEL } from '@family-home/shared/auth';
import type { UserAdmin, UserRole } from '../../api/user';
import { useUpdateUserRole } from './useUsers';

/**
 * 三档角色的下拉候选，顺序即"权限从大到小"，与后端 CurrentUserHolder 的常量对齐。
 *
 * 「超级管理员」这一项恒置灰（disabled）：全系统只能有一个超管、由种子固定，运行期不开放把别人提成超管
 * （后端 updateRole 也挡）。这一格永远不会是当前值——下拉只在"超管看别人的行"时渲染，而别人的行只可能是
 * 普通管理员或普通成员，超管那一行是操作人自己、渲染的是只读 RoleTag。置灰正是"非法选项前端就不给选"的样子。
 */
const ROLE_OPTIONS: { value: UserRole; label: string; disabled?: boolean }[] = [
  { value: ROLE.SUPER_ADMIN, label: ROLE_LABEL[ROLE.SUPER_ADMIN], disabled: true },
  { value: ROLE.ADMIN, label: ROLE_LABEL[ROLE.ADMIN] },
  { value: ROLE.MEMBER, label: ROLE_LABEL[ROLE.MEMBER] },
];

/**
 * 「这个人是什么角色」的三选一下拉，放在账号管理表格的「角色」列里。
 *
 * 上一版是一枚"超管/成员"二态开关；v48 角色变三档（超级管理员 / 普通管理员 / 普通成员），
 * 开关表达不了三态，改成 Select。仍然遵守那条老口径：**开关/下拉本身就是这一格的状态**，
 * 不再另配一个 Tag；弹窗里也刻意不重复这一格，所以全站只有这里能定角色。
 *
 * <p><b>它是唯一能替别人改的字段，且只有超级管理员能改</b>（后端 `updateRole` 是 `requireSuperAdmin`
 * 硬门禁）：昵称、手机号、口令三项仍然只有本人能在个人中心动。这一格买到的只是"这个人能进哪些页、
 * 能不能改业务数据"，换不到任何人的口令。
 *
 * <p><b>只在"超管看别人的行"时渲染</b>：调用方（`UserManagePage`）判过——非超管看谁都只读、
 * 超管看自己也只读（后端挡"改自己"，也挡"把别人提成超管"，全系统只能有一个超管）。所以这一条永远不会改动
 * 当前登录者的角色，本机那一格 `{role,permissions}` 因此不需要 refreshMe。被改的那个人看到的是下一次 `/me` 校准，不用重新登录。
 *
 * <p>mutation 挂在每一行自己身上（不是整页共用一枚），`loading` 因此只转被点的那一行。
 */
export function UserRoleSelect({ user }: { user: UserAdmin }) {
  const mutation = useUpdateUserRole();

  return (
    <Select<UserRole>
      value={user.role}
      options={ROLE_OPTIONS}
      loading={mutation.isPending}
      disabled={mutation.isPending}
      style={{ width: 128 }}
      onChange={(role) => void mutation.mutate({ id: user.id, role })}
    />
  );
}
