import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Result, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { PERMISSION, ROLE, ROLE_LABEL, can, isSuperAdmin, useCurrentUser } from '@family-home/shared/auth';
import { PageShell } from '../../components/PageShell';
import { useRoleMatrix, useSaveRoleMatrix } from '../../features/role/useRole';

/** 可编辑的两档角色（超管那一列不落库、恒全选禁用，不在这里）。顺序即列顺序。 */
const EDITABLE_ROLES = [ROLE.ADMIN, ROLE.MEMBER] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];

/** 矩阵的一行：一个权限项 + 它所属段的信息（段列用 rowSpan 合并，所以带上 span）。 */
interface MatrixRow {
  code: string;
  label: string;
  groupKey: string;
  groupLabel: string;
  /** 段列的合并行数：每段第一行 = 该段权限数，其余行 = 0（被合并掉） */
  groupRowSpan: number;
}

/**
 * 角色管理：一张可编辑的「角色 × 权限」勾选矩阵（v48 需求点名的形态）。
 *
 * 【三档角色，两档可编辑】列有超级管理员 / 普通管理员 / 普通成员三档，但**只有后两档能勾**：
 * 超管拥有全部权限、由后端短路，不落库、不可编辑——否则谁都能把超管勾没了、把自己锁死在系统外。
 * 所以超管那一列恒"全选且禁用"，也不进保存请求。
 *
 * 【行由后端下发】矩阵的行（权限段 + 中文标签）来自后端 `PermissionCatalog.GROUPS`，随 GET 现值返回，
 * 前端照着渲染、不另存一份目录，避免两端漂移。业务段两档（查看/管理）、系统后台段每页一项（访问）。
 *
 * 【读要 role.access，写只有超管】能进这一页（role.access）就能读这张表；但**保存是超管专属**
 * （后端 `requireSuperAdmin` 硬门禁，不进矩阵）。所以非超管进来是只读的：勾选框禁用、没有保存按钮，
 * 下面那行灰字告诉他为什么。这与"改角色也只有超管"是同一条护栏——否则普通管理员给自己勾上
 * user.access/role.access 就能自我提权。
 *
 * 【保存 = 提交该列完整清单】一次保存提交的是"这个角色现在勾了哪些码"（整批删旧插新），不是增量；
 * 全不勾 = 清空该角色权限。改完立即生效：身份是逐请求从库里现查的，被改的人下次请求就带新权限集合。
 *
 * 藏菜单只是体验——每个业务写接口、每个系统后台接口服务端都还各判一次权限，绕开 UI 直接敲照样 403。
 */
export function RoleManagePage() {
  const me = useCurrentUser();
  const canAccess = can(me, PERMISSION.ROLE_ACCESS);
  const editable = isSuperAdmin(me);
  const { data, isFetching } = useRoleMatrix(canAccess);
  const saveMutation = useSaveRoleMatrix();

  // 本地草稿：角色 → 已勾选的码集合。每次矩阵数据变化（首拉 / 保存后回读）都整格重置，
  // 这一页没有轮询，所以不存在"编辑到一半被后台刷新冲掉"的情况。
  const [draft, setDraft] = useState<Record<EditableRole, Set<string>>>({
    ADMIN: new Set(),
    MEMBER: new Set(),
  });

  useEffect(() => {
    if (!data) return;
    setDraft({
      ADMIN: new Set(data.grants[ROLE.ADMIN] ?? []),
      MEMBER: new Set(data.grants[ROLE.MEMBER] ?? []),
    });
  }, [data]);

  const rows = useMemo<MatrixRow[]>(() => {
    if (!data) return [];
    const out: MatrixRow[] = [];
    for (const group of data.groups) {
      group.perms.forEach((perm, index) => {
        out.push({
          code: perm.code,
          label: perm.label,
          groupKey: group.key,
          groupLabel: group.label,
          groupRowSpan: index === 0 ? group.perms.length : 0,
        });
      });
    }
    return out;
  }, [data]);

  /** 与服务端现值比对，得出哪些列有未保存的改动（保存按钮据此启用）。 */
  const dirtyRoles = useMemo<EditableRole[]>(() => {
    if (!data) return [];
    return EDITABLE_ROLES.filter((role) => {
      const server = new Set(data.grants[role] ?? []);
      const local = draft[role];
      if (server.size !== local.size) return true;
      for (const code of local) if (!server.has(code)) return true;
      return false;
    });
  }, [data, draft]);

  if (!canAccess) {
    return <Result status="403" title="没有查看角色管理的权限" />;
  }

  const toggle = (role: EditableRole, code: string, checked: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev[role]);
      if (checked) next.add(code);
      else next.delete(code);
      return { ...prev, [role]: next };
    });
  };

  const handleSave = async () => {
    for (const role of dirtyRoles) {
      await saveMutation.mutateAsync({ role, codes: Array.from(draft[role]) });
    }
  };

  const columns: NonNullable<TableProps<MatrixRow>['columns']> = [
    {
      title: '权限段',
      dataIndex: 'groupLabel',
      width: 120,
      onCell: (row) => ({ rowSpan: row.groupRowSpan }),
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    { title: '权限项', dataIndex: 'label' },
    {
      title: ROLE_LABEL[ROLE.SUPER_ADMIN],
      key: 'super',
      width: 120,
      align: 'center',
      // 超管恒全选、禁用：不落库、不可编辑（理由见类注释）
      render: () => <Checkbox checked disabled />,
    },
    ...EDITABLE_ROLES.map((role) => ({
      title: ROLE_LABEL[role],
      key: role,
      width: 120,
      align: 'center' as const,
      render: (_: unknown, row: MatrixRow) => (
        <Checkbox
          checked={draft[role].has(row.code)}
          disabled={!editable}
          onChange={(event) => toggle(role, row.code, event.target.checked)}
        />
      ),
    })),
  ];

  return (
    <PageShell
      title="角色管理"
      actions={
        editable ? (
          <Button
            type="primary"
            disabled={dirtyRoles.length === 0}
            loading={saveMutation.isPending}
            onClick={() => void handleSave()}
          >
            保存
          </Button>
        ) : null
      }
      toolbar={
        <Space>
          {dirtyRoles.length > 0 ? <Tag color="orange">有未保存的修改</Tag> : null}
          {!editable ? (
            <Typography.Text type="secondary">只有超级管理员能修改权限矩阵，当前为只读。</Typography.Text>
          ) : null}
        </Space>
      }
    >
      <Table<MatrixRow>
        rowKey="code"
        size="middle"
        bordered
        pagination={false}
        loading={isFetching}
        dataSource={rows}
        columns={columns}
      />
    </PageShell>
  );
}
