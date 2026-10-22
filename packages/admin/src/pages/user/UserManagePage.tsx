import { useState } from 'react';
import { Avatar, Button, Popconfirm, Result, Space, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { PERMISSION, ROLE, ROLE_LABEL, can, isSuperAdmin, useCurrentUser } from '@family-home/shared/auth';
import { resolveUserAvatar } from '@family-home/shared/image';
import type { UserAdmin, UserRole } from '../../api/user';
import { PageShell } from '../../components/PageShell';
import { ResponsiveList } from '../../components/ResponsiveList';
import { TimeText } from '../../components/TimeText';
import { UserCreateModal } from '../../features/user/UserCreateModal';
import { UserRoleSelect } from '../../features/user/UserRoleSelect';
import { useDeleteUser, useUsers } from '../../features/user/useUsers';

/** 角色标签的配色：超管金、管理员蓝、成员默认灰。措辞统一取自 shared 的 ROLE_LABEL（与后端常量对齐）。 */
const ROLE_COLOR: Record<UserRole, string> = {
  SUPER_ADMIN: 'gold',
  ADMIN: 'blue',
  MEMBER: 'default',
};

/**
 * 只读的那个角色标签：用在"改不了"的行——自己那一行、以及非超管看所有行（理由见下）。
 * 别人的行且当前是超管时渲染的才是可编辑的三选一下拉，两类控件在「角色」这一列里不会同时出现。
 */
function RoleTag({ role }: { role: UserRole }) {
  return <Tag color={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Tag>;
}

/**
 * 账号管理（有 user.access 权限的人看得到这一页；默认只有超级管理员有）。
 *
 * 【这一页三个动作：加人、删人、定角色】没有"编辑"、也没有口令：昵称、手机号、口令三项
 * 全系统只有个人中心那一个入口，且只能改自己的（后端那条"替别人改资料"的
 * `PUT /api/b/user/{id}` 仍然不存在，只多了一条最小粒度的 `PUT /{id}/role`）。页面上也不可能
 * 出现任何口令列——`UserAdminVO` 里没有那个字段，实体上的哈希又标了 `select = false`，
 * 管理员连查都查不出来。
 *
 * 【定角色只有超管能做，且造不出第二个超管】角色是三选一下拉（超级管理员 / 普通管理员 / 普通成员），但
 * **只有当前登录者是超管、且不是改自己那一行**时才可编辑；其余一律只读标签。下拉里「超级管理员」这一项恒置灰——
 * 全系统只能有一个超管（后端 `updateRole` 是 `requireSuperAdmin` 硬门禁，还挡"改自己"和"把别人提成超管"），
 * 前端这两道只读/置灰正是那几条护栏的样子。
 *
 * 【删人：只有超管不可删】超级管理员那一行不给删除按钮（后端也挡，"超级管理员账号不能删除"）；
 * 普通管理员与普通成员都能直接删。超管是全系统的根、且只能有一个，删了就没人能再管账号与权限。
 *
 * 【两道门槛的分工】菜单里露不露（AdminLayout）、直接敲 URL 进不进得来（下面的 403 分支）
 * 都只是体验；真正的判据在服务端 —— 账号管理那四个接口每个都调 requirePermission(USER_ACCESS)。
 * 这里的 403 分支不能省：`useUsers(false)` 只是不发请求，少了它页面会渲染成一张空表，
 * 看上去像"还没有账号"，那是最容易被误解成数据丢了的样子。
 *
 * 【不做分页也不做搜索】全家就这几个人，后端 List 整表返回。
 */
export function UserManagePage() {
  const me = useCurrentUser();
  const canAccess = can(me, PERMISSION.USER_ACCESS);
  const superAdmin = isSuperAdmin(me);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: users = [], isFetching } = useUsers(canAccess);
  const deleteMutation = useDeleteUser();

  if (!canAccess) {
    return <Result status="403" title="没有管理账号的权限" />;
  }

  /** 只有"超管改别人的行"给下拉；自己那一行、以及非超管看任何行都只读（后端两道护栏在前端的样子）。 */
  const renderRole = (record: UserAdmin) =>
    superAdmin && record.id !== me?.id ? <UserRoleSelect user={record} /> : <RoleTag role={record.role} />;

  /** 只有超级管理员不可删；普通管理员与普通成员都给删除按钮（与后端 delete 的护栏一致）。 */
  const canDelete = (record: UserAdmin) => record.role !== ROLE.SUPER_ADMIN;

  const columns: NonNullable<TableProps<UserAdmin>['columns']> = [
    {
      title: '头像',
      key: 'avatar',
      width: 72,
      render: (_, record) => <Avatar size={40} src={resolveUserAvatar(record.avatarUrl)} />,
    },
    { title: '昵称', dataIndex: 'name', width: 140 },
    { title: '手机号', dataIndex: 'phone', width: 160 },
    {
      title: '角色',
      key: 'role',
      width: 148,
      render: (_, record) => renderRole(record),
    },
    {
      title: '添加时间',
      dataIndex: 'createTime',
      width: 160,
      render: (value: string) => <TimeText value={value} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) =>
        canDelete(record) && (
          <Popconfirm
            title={`确定要删除「${record.name}」吗？`}
            description="删除后这个账号无法登录；它历史上加过的图片、菜品、订单仍然显示在那里。"
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void deleteMutation.mutate(record.id)}
          >
            <Button size="small" danger loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <PageShell
      title="账号管理"
      actions={
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新增账号
        </Button>
      }
      toolbar={<Tag>{`共 ${users.length} 个账号`}</Tag>}
    >
      <ResponsiveList<UserAdmin>
        items={users}
        keyOf={(item) => item.id}
        columns={columns}
        loading={isFetching}
        renderCard={(item) => (
          <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space align="center">
              <Avatar size={40} src={resolveUserAvatar(item.avatarUrl)} />
              <Space orientation="vertical" size={2}>
                <Space size={6}>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  {renderRole(item)}
                </Space>
                <Typography.Text type="secondary">{item.phone}</Typography.Text>
                <TimeText value={item.createTime} label="添加" />
              </Space>
            </Space>
            {canDelete(item) && (
              <Popconfirm
                title={`确定要删除「${item.name}」吗？`}
                description="删除后这个账号无法登录；它历史上加过的图片、菜品、订单仍然显示在那里。"
                okText="确定删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => void deleteMutation.mutate(item.id)}
              >
                <Button size="small" danger loading={deleteMutation.isPending}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        )}
      />

      <UserCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageShell>
  );
}
