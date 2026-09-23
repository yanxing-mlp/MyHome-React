import { Avatar, Dropdown, Typography } from 'antd';
import { useNavigate } from 'react-router';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { clearCurrentUser, useCurrentUser } from '@family-home/shared/auth';
import { resolveUserAvatar } from '@family-home/shared/image';

const { Text } = Typography;

/**
 * 「当前是谁」这一块，B 端两个位置共用：桌面侧栏底部、窄屏顶栏右侧。
 *
 * 下拉固定为「个人中心 / 注销」，所有角色一致。
 * 个人中心只从这里进入；账号管理保留在管理员侧栏，不放进头像下拉。
 * 换人靠注销清掉本机身份后重新登录，不再单设「切换账号」入口（它与注销动作完全相同）；注销不删除账号。
 *
 * 【头像】没设过头像时给 shared 的默认剪影（resolveUserAvatar），不留空圈。
 */
export function CurrentUserBlock({ collapsed = false }: { collapsed?: boolean }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  if (!user) return null;

  const items = [
    { key: 'profile', label: '个人中心', icon: <UserOutlined /> },
    { key: 'logout', label: '注销', icon: <LogoutOutlined /> },
  ];

  const onClick = ({ key }: { key: string }) => {
    if (key === 'profile') navigate('/profile');
    if (key === 'logout') clearCurrentUser();
  };

  return (
    <Dropdown menu={{ items, onClick }} trigger={['click']} placement="topRight">
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          // 收起态只剩 64px：头像居中、不显示昵称，与顶部品牌位的处理一致
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 8,
          minWidth: 0,
          padding: collapsed ? '8px 0' : '8px 12px',
          cursor: 'pointer',
        }}
      >
        <Avatar size={28} src={resolveUserAvatar(user.avatarUrl)} />
        {!collapsed && (
          <Text ellipsis={{ tooltip: user.name }} style={{ minWidth: 0, fontSize: 13 }}>
            {user.name}
          </Text>
        )}
      </span>
    </Dropdown>
  );
}
