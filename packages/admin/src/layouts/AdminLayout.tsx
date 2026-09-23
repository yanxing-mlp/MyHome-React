import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Button, Drawer, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  FileTextOutlined,
  ForkOutlined,
  HomeOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PictureOutlined,
  PlaySquareOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useIsDesktop } from '@family-home/shared/hooks';
import { useCurrentUser } from '@family-home/shared/auth';
import { FH_LOGO, FH_LOGO_ALT } from '@family-home/shared/brand';
import { BackendStatus } from '../components/BackendStatus';
import { CurrentUserBlock } from '../components/CurrentUserBlock';

const { Header, Sider, Content, Footer } = Layout;

/**
 * 侧栏/顶栏那一行的品牌位：图形 + 产品名。
 *
 * 收起态只有 64px，放不下"家庭 Home"五个字，所以 `showText=false` 时只留图形 ——
 * 这正是这一轮把 logo 加进收起态的意义：之前那一栏整条是空的，收起后连"这是哪个系统"都认不出。
 * 尺寸给 24：徽牌是圆角方形，24px 时心形门已经只是一个色点，房子轮廓仍可辨；再小就成色块了。
 */
function BrandMark({ showText }: { showText: boolean }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        fontWeight: 600,
        fontSize: 16,
      }}
    >
      <img src={FH_LOGO} alt={FH_LOGO_ALT} width={24} height={24} style={{ flex: 'none', display: 'block' }} />
      {showText && (
        <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{FH_LOGO_ALT}</span>
      )}
    </span>
  );
}

/**
 * 左侧菜单。
 *
 * 首页（/home）是一级平铺项，其余按"做什么事"分：菜谱 / 点单管理 / 相册 / 文件管理 / 密码本。
 * （菜谱与点单管理排在相册之前，2026-09-22 按用户要求调整；只是展示顺序，key 与路由都不变。）
 * 点单管理（列表 / 统计 / 做法）是从菜谱里拆出来的独立一组——按用户要求，
 * 但 URL 仍留在 /recipe/* 下：后端这些接口本来就都在 fh-module-recipe 里，
 * 路径跟域走，菜单只管分组。
 * 文件管理、视频管理、密码本各分公共/私人两个子菜单，共用页面但数据独立。
 * 个人中心（/profile）只从头像下拉进入，不占侧栏菜单；普通成员同样可用。
 *
 * 「账号管理」不在这张常量表里：只有 ADMIN 看得到（见下面 menuItems），
 * 但藏菜单只是体验——那五个接口服务端每个都还判一次 ADMIN，绕开 UI 直接敲接口照样 403。
 *
 * 一级项都带 icon：侧栏可以一键收起成 64px 图标窄栏（见下面的 collapsed），
 * 收起态只剩图标可点，没有 icon 的一级项会变成一片空白。二级项不加，
 * 收起态下它们是 hover 弹出的浮层，靠文字就能认。
 */
const MENU_ITEMS: MenuProps['items'] = [
  { key: '/home', icon: <HomeOutlined />, label: '首页' },
  {
    key: 'sub-recipe',
    icon: <ForkOutlined />,
    label: '菜谱',
    children: [
      { key: '/recipe', label: '菜谱列表' },
      { key: '/recipe/categories', label: '菜品分类' },
    ],
  },
  {
    key: 'sub-order',
    icon: <ShoppingCartOutlined />,
    label: '点单管理',
    children: [
      { key: '/recipe/orders', label: '点单列表' },
      { key: '/recipe/statistics', label: '点单统计' },
      { key: '/recipe/practices', label: '做法管理' },
    ],
  },
  {
    key: 'sub-album',
    icon: <PictureOutlined />,
    label: '家庭相册',
    children: [
      { key: '/album/images', label: '图片管理' },
      { key: '/album/groups', label: '相册分组' },
      { key: '/album/distribution', label: '图片分布' },
    ],
  },
  {
    key: 'sub-personal-album',
    icon: <PictureOutlined />,
    label: '个人相册',
    children: [
      { key: '/album/personal/images', label: '图片管理' },
      { key: '/album/personal/groups', label: '相册分组' },
      { key: '/album/personal/distribution', label: '图片分布' },
    ],
  },
  {
    key: 'sub-file',
    icon: <FileTextOutlined />,
    label: '文件管理',
    children: [
      { key: '/file/public', label: '公共文件' },
      { key: '/file/private', label: '私人文件' },
    ],
  },
  {
    key: 'sub-video',
    icon: <PlaySquareOutlined />,
    label: '视频管理',
    children: [
      { key: '/video/public', label: '公共视频' },
      { key: '/video/private', label: '个人视频' },
    ],
  },
  {
    key: 'sub-vault',
    icon: <LockOutlined />,
    label: '密码本',
    children: [
      { key: '/vault/public', label: '公共密码' },
      { key: '/vault/private', label: '私人密码' },
    ],
  },
];

/** 点单管理这一组的二级路径（URL 仍在 /recipe 下，见上面菜单注释） */
const ORDER_PATHS = ['/recipe/orders', '/recipe/statistics', '/recipe/practices'];

/**
 * 侧栏收起状态存本机。和点餐页的列数偏好一样，这是"这台设备看着舒不舒服"的
 * 本机设置，不进后端：全家共用的是数据，不是每个人的窗口宽度。
 */
const COLLAPSE_KEY = 'admin-menu-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    // 隐私模式下读 localStorage 会抛，当作没收起
    return false;
  }
}

/** 该路径属于点单管理组吗（前缀匹配，/recipe/orders/5 这类子路由也要归位） */
function isOrderPath(pathname: string): boolean {
  return ORDER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * 从 pathname 反推选中的菜单项。
 * 子路由（/album/:groupId、/recipe/new、/recipe/:id/edit）要归位到父菜单，
 * 否则进入详情页后左侧菜单会失去高亮。
 */
function resolveSelectedKey(pathname: string): string {
  // 首页有两个入口：'/' 是直接访问，'/home' 是菜单入口（见 router 里那段注释）
  if (pathname === '/' || pathname === '/home') return '/home';
  // 个人前缀必须先于家庭；详情和旧入口均高亮各自的分组列表。
  if (pathname.startsWith('/album/personal')) {
    if (pathname.startsWith('/album/personal/images')) return '/album/personal/images';
    if (pathname.startsWith('/album/personal/distribution')) return '/album/personal/distribution';
    return '/album/personal/groups';
  }
  if (pathname.startsWith('/album/distribution')) return '/album/distribution';
  if (pathname.startsWith('/album/images')) return '/album/images';
  if (pathname.startsWith('/album')) return '/album/groups';
  if (pathname.startsWith('/recipe/categories')) return '/recipe/categories';
  if (isOrderPath(pathname)) {
    // /recipe/orders/5 这种详情子路由高亮回列表项，其余按自身
    const matched = ORDER_PATHS.find(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    return matched ?? '/recipe/orders';
  }
  if (pathname.startsWith('/recipe')) return '/recipe';
  if (pathname.startsWith('/file/private')) return '/file/private';
  if (pathname.startsWith('/file')) return '/file/public';
  if (pathname.startsWith('/video/private')) return '/video/private';
  if (pathname.startsWith('/video')) return '/video/public';
  if (pathname.startsWith('/vault/private')) return '/vault/private';
  if (pathname.startsWith('/vault')) return '/vault/public';
  if (pathname.startsWith('/profile')) return '';
  if (pathname.startsWith('/user')) return '/user';
  return '/album/groups';
}

/**
 * 根据当前路径计算应该展开的父级菜单 key。
 * 当用户在二级菜单时，确保对应的一级菜单保持展开状态。
 */
function resolveOpenKeys(pathname: string): string[] {
  const openKeys: string[] = [];

  if (pathname.startsWith('/album/personal')) {
    openKeys.push('sub-personal-album');
  } else if (pathname.startsWith('/album')) {
    openKeys.push('sub-album');
  }
  if (pathname.startsWith('/recipe')) {
    // 菜谱与点单管理共用 /recipe 前缀，按二级路径分组，只点亮真正所属的那个
    openKeys.push(isOrderPath(pathname) ? 'sub-order' : 'sub-recipe');
  }
  if (pathname.startsWith('/file')) openKeys.push('sub-file');
  if (pathname.startsWith('/video')) openKeys.push('sub-video');
  if (pathname.startsWith('/vault')) openKeys.push('sub-vault');

  return openKeys;
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
  const user = useCurrentUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState(() => resolveOpenKeys(location.pathname));
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // 路由变化时展开所属模块；同一路由下尊重手动收起（空数组也是有效状态）。
  useEffect(() => {
    setOpenKeys(resolveOpenKeys(location.pathname));
  }, [location.pathname]);

  // 「账号管理」只有 ADMIN 看得见；服务端每个账号接口还会再判一次，这里只管菜单
  const menuItems: MenuProps['items'] =
    user?.role === 'ADMIN'
      ? [...(MENU_ITEMS ?? []), { key: '/user', icon: <TeamOutlined />, label: '账号管理' }]
      : MENU_ITEMS;

  const selectedKey = resolveSelectedKey(location.pathname);
  
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (!next) {
      setOpenKeys(resolveOpenKeys(location.pathname));
    }
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // 写不进去只是下次进来不记住，本次的收起照常生效
    }
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    // 只有以 / 开头的 key 才是路由，'sub-recipe' 是分组标题不导航
    if (key.startsWith('/')) {
      navigate(key);
      setDrawerOpen(false);
    }
  };

  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys);
  };

  const menu = (
    <Menu
      mode="inline"
      items={menuItems}
      selectedKeys={selectedKey ? [selectedKey] : []}
      openKeys={openKeys}
      onOpenChange={handleOpenChange}
      onClick={handleMenuClick}
      style={{ borderInlineEnd: 'none' }}
    />
  );

  if (isDesktop) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          width={208}
          collapsedWidth={64}
          collapsed={collapsed}
          trigger={null}
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0' }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              // 展开态：品牌靠左、收起按钮靠右；收起态：两样都居中挤进 64px（24 + 4 + 32）
              justifyContent: collapsed ? 'center' : 'space-between',
              gap: collapsed ? 4 : 8,
              padding: collapsed ? 0 : '0 8px 0 16px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <BrandMark showText={!collapsed} />
            <Button
              type="text"
              aria-label={collapsed ? '展开菜单' : '收起菜单'}
              onClick={toggleCollapsed}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            />
          </div>
          {/* antd 的 .ant-layout-sider-children 本身就是 flex column，菜单吃掉剩余高度，
              「当前用户」这一栏才稳在底部；否则菜单项一多，底部会被挤到看不见。 */}
          <div style={{ flex: 1, overflow: 'auto' }}>{menu}</div>
          <div style={{ borderTop: '1px solid #f0f0f0' }}>
            <CurrentUserBlock collapsed={collapsed} />
          </div>
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
        <BrandMark showText />
        <span style={{ flex: 1 }} />
        <BackendStatus />
        {/* 窄屏没有侧栏，当前用户挪到顶栏右侧；抽屉里那份菜单同样带「账号管理」 */}
        <CurrentUserBlock />
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
