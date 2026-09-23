import { useState } from 'react';
import { Avatar, Button, Popconfirm, Result, Space, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { useCurrentUser } from '@family-home/shared/auth';
import { resolveUserAvatar } from '@family-home/shared/image';
import type { UserAdmin } from '../../api/user';
import { PageShell } from '../../components/PageShell';
import { ResponsiveList } from '../../components/ResponsiveList';
import { TimeText } from '../../components/TimeText';
import { UserCreateModal } from '../../features/user/UserCreateModal';
import { UserRoleSwitch } from '../../features/user/UserRoleSwitch';
import { useDeleteUser, useUsers } from '../../features/user/useUsers';

/** 角色只有两档，措辞与后端 CurrentUserHolder 的常量对齐 */
const ROLE_LABEL: Record<UserAdmin['role'], string> = {
  ADMIN: '管理员',
  MEMBER: '普通成员',
};

/**
 * 只读的那个角色标签：只有**自己那一行**用它（那一行不给开关，理由见 `UserRoleSwitch`）。
 * 别人的行渲染的是开关本身，两类控件在「角色」这一列里不会同时出现。
 */
function RoleTag({ role }: { role: UserAdmin['role'] }) {
  return <Tag color={role === 'ADMIN' ? 'blue' : undefined}>{ROLE_LABEL[role]}</Tag>;
}

/**
 * 账号管理（只有 ADMIN 看得到这一页）。
 *
 * 【这一页三个动作：加人、删人、定谁是超管】没有"编辑"、也没有口令：昵称、手机号、口令三项
 * 全系统只有个人中心那一个入口，且只能改自己的（后端那条"替别人改资料"的
 * `PUT /api/b/user/{id}` 仍然不存在，只多了一条最小粒度的 `PUT /{id}/role`）。页面上也不可能
 * 出现任何口令列——`UserAdminVO` 里没有那个字段，实体上的哈希又标了 `select = false`，
 * 管理员连查都查不出来。
 *
 * 【两道门槛的分工】菜单里露不露（AdminLayout）、直接敲 URL 进不进得来（下面的 403 分支）
 * 都只是体验；真正的判据在服务端 —— 账号管理那四个接口每个都调 requireAdmin()。
 * 这里的 403 分支不能省：`useUsers(false)` 只是不发请求，少了它页面会渲染成一张空表，
 * 看上去像"还没有账号"，那是最容易被误解成数据丢了的样子。
 *
 * 【不做分页也不做搜索】全家就这几个人，后端 List 整表返回。
 * 哪天成员上两位数再加搜索也不迟，那一天的表格也不必现在先搭好分页 state。
 */
export function UserManagePage() {
  const me = useCurrentUser();
  const isAdminUser = me?.role === 'ADMIN';
  const [createOpen, setCreateOpen] = useState(false);
  const { data: users = [], isFetching } = useUsers(isAdminUser);
  const deleteMutation = useDeleteUser();

  if (!isAdminUser) {
    return <Result status="403" title="只有管理员能管理账号" />;
  }

  /** 自己那一行只读、别人的行是开关：后端那两道护栏（不能改自己 / 不能降级最后一个管理员）在前端就长这样 */
  const renderRole = (record: UserAdmin) =>
    record.id === me?.id ? <RoleTag role={record.role} /> : <UserRoleSwitch user={record} />;

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
      width: 96,
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
      render: (_, record) => (
        // 管理员账号不可删：后端会挡（"请先取消其管理员角色"），这里对 ADMIN 行直接不给按钮。
        // 要删某个管理员，先在「角色」列把他降成普通成员，降下来这一格才会出现删除按钮。
        record.role !== 'ADMIN' && (
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
        )
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
            {item.role !== 'ADMIN' && (
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
