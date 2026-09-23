import { Switch } from 'antd';
import type { UserAdmin } from '../../api/user';
import { useUpdateUserRole } from './useUsers';

/**
 * 「谁是超管」开关，放在账号管理表格的「角色」列里。
 *
 * 与相册那两枚上下架开关（`AlbumGroupStatusSwitch` / `AlbumImageStatusSwitch`）同一口径：
 * **开关本身就是这一格的状态**，不再另配一个 Tag；也不给 `size="small"`——小尺寸轨道塞不下
 * "超管/成员"两个汉字。弹窗里刻意不重复这一格，所以全站只有这里能定角色。
 *
 * <p><b>它是管理员唯一能替别人改的字段</b>：昵称、手机号、口令三项仍然只有本人能在
 * 个人中心动（`PUT /api/b/user/{id}` 那条"替别人编辑"整个接口仍然不存在）。这一格买到的
 * 只是"谁能进账号管理这一页"，换不到任何人的口令。
 *
 * <p><b>自己那一行不会渲染到这里</b>：调用方（`UserManagePage`）拿 `record.id !== me.id`
 * 判过，后端也挡（"请让另一位管理员操作"）。两条护栏合起来保证"改完仍然至少有一个管理员能管账号"，
 * 也保证这一条永远不会改到当前登录者的角色——所以这里不需要 `refreshMe()`。
 * 被改的那个人看到的是下一次 `/me` 校准（进页面时），不用重新登录。
 *
 * <p>mutation 挂在每一行自己身上（不是整页共用一枚），`loading` 因此只转被点的那一枚开关。
 */
export function UserRoleSwitch({ user }: { user: UserAdmin }) {
  const isAdmin = user.role === 'ADMIN';
  const mutation = useUpdateUserRole();

  return (
    <Switch
      checked={isAdmin}
      loading={mutation.isPending}
      checkedChildren="超管"
      unCheckedChildren="成员"
      onChange={() => void mutation.mutate({ id: user.id, role: isAdmin ? 'MEMBER' : 'ADMIN' })}
    />
  );
}
