import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Button, Drawer, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useIsDesktop } from '@family-home/shared/hooks';
import { BackendStatus } from '../components/BackendStatus';

const { Header, Sider, Content, Footer } = Layout;

/**
 * 左侧菜单。
 *
 * 用户一期要求"就两个一级菜单"（相册 / 菜谱）。v5 新增账号本模块后变成三项——
 * 这是需求本身从 2 个模块变 3 个模块的结果，不是把菜单放开。
 * 标签管理和类型管理仍挂在"菜谱"下作二级：它们是完整 CRUD 页面，
 * 塞进 Modal 会让弹窗过于复杂（方案 §7.3）。
 */
const MENU_ITEMS: MenuProps['items'] = [
  { key: '/album', label: '相册' },
  {
    key: 'sub-recipe',
    label: '菜谱',
    children: [
      { key: '/recipe', label: '菜谱列表' },
      { key: '/recipe/tags', label: '标签管理' },
      { key: '/recipe/types', label: '类型管理' },
    ],
  },
  { key: '/vault', label: '账号本' },
];

/**
 * 从 pathname 反推选中的菜单项。
 * 子路由（/album/:groupId、/recipe/new、/recipe/:id/edit）要归位到父菜单，
 * 否则进入详情页后左侧菜单会失去高亮。
 */
function resolveSelectedKey(pathname: string): string {
  if (pathname.startsWith('/recipe/tags')) return '/recipe/tags';
  if (pathname.startsWith('/recipe/types')) return '/recipe/types';
  if (pathname.startsWith('/recipe')) return '/recipe';
  if (pathname.startsWith('/vault')) return '/vault';
  return '/album';
}

/**
 * B 端响应式布局（方案 §7.2 第 1 点）。
 *
 * >= 992px：左侧固定 Sider。
 * <  992px：顶部 Header + 汉堡按钮开 Drawer。
 *
 * 断点判定用 shared 里的 useIsDesktop（matchMedia 实现），不依赖 antd 的 Grid API。
 */
export function AdminLayout() {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedKey = resolveSelectedKey(location.pathname);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    // 只有以 / 开头的 key 才是路由，'sub-recipe' 是分组标题不导航
    if (key.startsWith('/')) {
      navigate(key);
      setDrawerOpen(false);
    }
  };

  const menu = (
    <Menu
      mode="inline"
      items={MENU_ITEMS}
      selectedKeys={[selectedKey]}
      defaultOpenKeys={['sub-recipe']}
      onClick={handleMenuClick}
      style={{ borderInlineEnd: 'none' }}
    />
  );

  if (isDesktop) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={208} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 24,
              fontWeight: 600,
              fontSize: 16,
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            家庭 Home
          </div>
          {menu}
        </Sider>
        <Layout>
          <Content style={{ padding: 24, overflow: 'auto' }}>
            <Outlet />
          </Content>
          <Footer style={{ padding: '10px 24px', textAlign: 'right', background: '#fff' }}>
            <BackendStatus />
          </Footer>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 56,
          lineHeight: '56px',
          padding: '0 12px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Button type="text" aria-label="打开菜单" onClick={() => setDrawerOpen(true)}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
        </Button>
        <Typography.Text strong>家庭 Home</Typography.Text>
        <span style={{ flex: 1 }} />
        <BackendStatus />
      </Header>
      <Content style={{ padding: 16 }}>
        <Outlet />
      </Content>
      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={240}
        title="菜单"
        styles={{ body: { padding: 0 } }}
      >
        {menu}
      </Drawer>
    </Layout>
  );
}
