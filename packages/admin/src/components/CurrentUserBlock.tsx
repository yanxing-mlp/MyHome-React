import { Avatar, Dropdown, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router';
import { CheckOutlined, IdcardOutlined, LogoutOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { clearCurrentUser, useCurrentUser } from '@family-home/shared/auth';
import { resolveUserAvatar } from '@family-home/shared/image';
import { useDomain } from '../lib/domain';

const { Text } = Typography;

/** 域切换项的文字：当前域在右侧打一个勾，一眼看出现在在哪一域。 */
function domainLabel(text: string, active: boolean) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {text}
      {active && <CheckOutlined style={{ fontSize: 12, color: '#1677ff' }} />}
    </span>
  );
}

/**
 * 「当前是谁」这一块，B 端两个位置共用：桌面侧栏底部、窄屏顶栏右侧。
 *
 * 下拉从上到下：家庭 / 个人（公私域切换，当前域打勾）── 分隔线 ── 个人中心 / 注销。
 * 切域只是换侧栏那一套菜单并跳到当前模块的对应档（见 lib/domain.ts），不碰身份、不重新登录；
 * 点当前所在的域是 no-op。个人中心只从这里进入；账号管理保留在管理员侧栏，不放进头像下拉。
 * 换人靠注销清掉本机身份后重新登录，不再单设「切换账号」入口（它与注销动作完全相同）；注销不删除账号。
 *
 * 【头像】没设过头像时给 shared 的默认剪影（resolveUserAvatar），不留空圈。
 */
export function CurrentUserBlock({ collapsed = false }: { collapsed?: boolean }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { domain, setDomain } = useDomain();
  if (!user) return null;

  const items: MenuProps['items'] = [
    { key: 'domain:FAMILY', icon: <TeamOutlined />, label: domainLabel('家庭', domain === 'FAMILY') },
    { key: 'domain:PERSONAL', icon: <UserOutlined />, label: domainLabel('个人', domain === 'PERSONAL') },
    { type: 'divider' },
    { key: 'profile', icon: <IdcardOutlined />, label: '个人中心' },
    { key: 'logout', icon: <LogoutOutlined />, label: '注销' },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'domain:FAMILY') setDomain('FAMILY');
    else if (key === 'domain:PERSONAL') setDomain('PERSONAL');
    else if (key === 'profile') navigate('/profile');
    else if (key === 'logout') clearCurrentUser();
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
