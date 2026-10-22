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
  SettingOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useIsDesktop } from '@family-home/shared/hooks';
import { can, PERMISSION, useCurrentUser, type CurrentUser } from '@family-home/shared/auth';
import { FH_LOGO, FH_LOGO_ALT } from '@family-home/shared/brand';
import { BackendStatus } from '../components/BackendStatus';
import { CurrentUserBlock } from '../components/CurrentUserBlock';
import { DomainSwitch } from '../components/DomainSwitch';
import { useDomain } from '../lib/domain';

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
 * 左侧菜单，按当前「域」（家庭 / 个人）+ 当前用户的「权限」双重过滤后渲染。
 *
 * 域切换在头像下拉里（见 CurrentUserBlock + lib/domain.ts）。过去把「家庭相册 / 个人相册」
 * 并列成两个一级菜单、文件/视频/密码本又各自拆「公共 / 私人」二级子菜单——同一件事出现两遍；
 * 现在收敛成一套：家庭域用家庭/公共那一档，个人域用个人/私人那一档，模块在菜单里只出现一次。
 *
 * 家庭域（FAMILY）：首页 / 菜谱 / 点单管理 / 相册 / 文件管理 / 视频管理 / 密码本 + 系统后台。
 * 个人域（PERSONAL）：只有相册 / 文件管理 / 视频管理 / 密码本四项个人版——首页、菜谱、点单、
 * 系统后台都是家庭共享、没有个人版，只在家庭域出现（用户口径）。
 *
 * 相册有图片管理 / 相册分组 / 图片分布三个子页（sub-album）；文件、视频各有「全部 + 分组」
 * 两级（sub-file / sub-video）——分组是这一轮新加的归类维度，和相册一样做成"分组列表→点进看内容"。
 * 密码本仍是一级平铺项（key 直接用完整路径），它没有分组概念。
 * 点单管理（列表 / 统计 / 做法）URL 仍在 /recipe/* 下，菜单只管分组（后端接口都在 recipe 模块）。
 * 个人中心（/profile）只从头像下拉进入，不占侧栏菜单。
 *
 * 【权限过滤是这一版新加的】每个业务模块的可见性由该模块的 `.view` 权限码决定，系统后台那一组
 * 的每一项由各自的 `.access` 决定，整组只有"至少勾中一项"时才出现。三档角色默认：超管全都有
 * （短路）、普通管理员有六个业务 view+manage、没有系统后台任何 access；普通成员只有六个业务 view。
 * 但<b>藏菜单只是体验</b>——这些接口服务端每个都还判一次权限（业务写判 `.manage`、系统后台判 `.access`），
 * 绕开 UI 直接敲接口照样 403；业务读接口三角色都放行，成员"能看不能改"正是靠前端置灰 + 后端写门禁。
 *
 * 一级项都带 icon：侧栏可以一键收起成 64px 图标窄栏（见下面的 collapsed），
 * 收起态只剩图标可点，没有 icon 的一级项会变成一片空白。二级项不加，
 * 收起态下它们是 hover 弹出的浮层，靠文字就能认。
 */
function familyMenuItems(user: CurrentUser | null): MenuProps['items'] {
  const items: MenuProps['items'] = [];
  // 首页是登录后的落地页，任何进了 B 端的角色都看得到（不挂权限），否则成员登录会白屏无落点。
  items.push({ key: '/home', icon: <HomeOutlined />, label: '首页' });
  if (can(user, PERMISSION.RECIPE_VIEW)) {
    items.push({
      key: 'sub-recipe',
      icon: <ForkOutlined />,
      label: '菜谱',
      children: [
        { key: '/recipe', label: '菜谱列表' },
        { key: '/recipe/categories', label: '菜品分类' },
      ],
    });
  }
  if (can(user, PERMISSION.ORDER_VIEW)) {
    items.push({
      key: 'sub-order',
      icon: <ShoppingCartOutlined />,
      label: '点单管理',
      children: [
        { key: '/recipe/orders', label: '点单列表' },
        { key: '/recipe/statistics', label: '点单统计' },
        { key: '/recipe/practices', label: '做法管理' },
      ],
    });
  }
  if (can(user, PERMISSION.ALBUM_VIEW)) {
    items.push({
      key: 'sub-album',
      icon: <PictureOutlined />,
      label: '相册',
      children: [
        { key: '/album/images', label: '图片管理' },
        { key: '/album/groups', label: '相册分组' },
        { key: '/album/distribution', label: '图片分布' },
      ],
    });
  }
  if (can(user, PERMISSION.FILE_VIEW)) {
    items.push({
      key: 'sub-file',
      icon: <FileTextOutlined />,
      label: '文件管理',
      children: [
        { key: '/file/public', label: '全部文件' },
        { key: '/file/public/groups', label: '文件分组' },
      ],
    });
  }
  if (can(user, PERMISSION.VIDEO_VIEW)) {
    items.push({
      key: 'sub-video',
      icon: <PlaySquareOutlined />,
      label: '视频管理',
      children: [
        { key: '/video/public', label: '全部视频' },
        { key: '/video/public/groups', label: '视频分组' },
      ],
    });
  }
  if (can(user, PERMISSION.VAULT_VIEW)) {
    items.push({ key: '/vault/public', icon: <LockOutlined />, label: '密码本' });
  }
  // 系统后台：每项各自判 access，整组"至少勾中一项"才出现（普通管理员/成员默认一个都没有 → 整组不渲染）。
  const systemChildren: NonNullable<MenuProps['items']> = [];
  if (can(user, PERMISSION.USER_ACCESS)) systemChildren.push({ key: '/user', label: '账号管理' });
  if (can(user, PERMISSION.ROLE_ACCESS)) systemChildren.push({ key: '/role', label: '角色管理' });
  if (can(user, PERMISSION.STORAGE_ACCESS)) systemChildren.push({ key: '/storage', label: '目录管理' });
  if (can(user, PERMISSION.CHANGELOG_ACCESS)) systemChildren.push({ key: '/change-log', label: '变更记录' });
  if (can(user, PERMISSION.DEPLOY_ACCESS)) systemChildren.push({ key: '/deploy', label: '部署管理' });
  if (can(user, PERMISSION.LOGS_ACCESS)) systemChildren.push({ key: '/logs', label: '系统日志' });
  if (can(user, PERMISSION.OPLOG_ACCESS)) systemChildren.push({ key: '/operation-logs', label: '操作记录' });
  if (can(user, PERMISSION.KNOWLEDGE_ACCESS)) systemChildren.push({ key: '/knowledge', label: '知识库' });
  if (can(user, PERMISSION.SERVER_REPO_ACCESS)) systemChildren.push({ key: '/server-repo', label: '后端代码' });
  if (can(user, PERMISSION.WEB_REPO_ACCESS)) systemChildren.push({ key: '/web-repo', label: '前端代码' });
  if (can(user, PERMISSION.DATABASE_ACCESS)) systemChildren.push({ key: '/database', label: '数据库' });
  if (systemChildren.length > 0) {
    items.push({ key: 'sub-system', icon: <SettingOutlined />, label: '系统后台', children: systemChildren });
  }
  return items;
}

function personalMenuItems(user: CurrentUser | null): MenuProps['items'] {
  const items: MenuProps['items'] = [];
  if (can(user, PERMISSION.ALBUM_VIEW)) {
    items.push({
      key: 'sub-album',
      icon: <PictureOutlined />,
      label: '相册',
      children: [
        { key: '/album/personal/images', label: '图片管理' },
        { key: '/album/personal/groups', label: '相册分组' },
        { key: '/album/personal/distribution', label: '图片分布' },
      ],
    });
  }
  if (can(user, PERMISSION.FILE_VIEW)) {
    items.push({
      key: 'sub-file',
      icon: <FileTextOutlined />,
      label: '文件管理',
      children: [
        { key: '/file/private', label: '全部文件' },
        { key: '/file/private/groups', label: '文件分组' },
      ],
    });
  }
  if (can(user, PERMISSION.VIDEO_VIEW)) {
    items.push({
      key: 'sub-video',
      icon: <PlaySquareOutlined />,
      label: '视频管理',
      children: [
        { key: '/video/private', label: '全部视频' },
        { key: '/video/private/groups', label: '视频分组' },
      ],
    });
  }
  if (can(user, PERMISSION.VAULT_VIEW)) {
    items.push({ key: '/vault/private', icon: <LockOutlined />, label: '密码本' });
  }
  return items;
}

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
 * 文件/视频两级菜单的选中项归位。
 *
 * base = /file/public 之类；`${base}/groups`（分组列表）与 `${base}/group/:id`（分组详情）
 * 都高亮回「分组」那一项（两者都以 `${base}/group` 开头），其余（含裸 base）高亮「全部」。
 * 返回 null 表示这条路径不属于该 root+档位。
 */
function resolveMediaKey(pathname: string, root: string, scopeSeg: string): string | null {
  const base = `${root}/${scopeSeg}`;
  if (!pathname.startsWith(base)) return null;
  return pathname.startsWith(`${base}/group`) ? `${base}/groups` : base;
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
  // 文件/视频两级：私人档先判（/file/private 也 startsWith /file），分组详情归位到「分组」项
  for (const root of ['/file', '/video']) {
    if (pathname.startsWith(root)) {
      return (
        resolveMediaKey(pathname, root, 'private') ??
        resolveMediaKey(pathname, root, 'public') ??
        `${root}/public`
      );
    }
  }
  if (pathname.startsWith('/vault/private')) return '/vault/private';
  if (pathname.startsWith('/vault')) return '/vault/public';
  if (pathname.startsWith('/profile')) return '';
  if (pathname.startsWith('/user')) return '/user';
  if (pathname.startsWith('/role')) return '/role';
  if (pathname.startsWith('/storage')) return '/storage';
  if (pathname.startsWith('/change-log')) return '/change-log';
  if (pathname.startsWith('/deploy')) return '/deploy';
  if (pathname.startsWith('/logs')) return '/logs';
  if (pathname.startsWith('/operation-logs')) return '/operation-logs';
  if (pathname.startsWith('/knowledge')) return '/knowledge';
  if (pathname.startsWith('/server-repo')) return '/server-repo';
  if (pathname.startsWith('/web-repo')) return '/web-repo';
  if (pathname.startsWith('/database')) return '/database';
  return '';
}

/**
 * 根据当前路径计算应该展开的父级菜单 key。
 * 当用户在二级菜单时，确保对应的一级菜单保持展开状态。
 * 只有相册（sub-album）、菜谱（sub-recipe）、点单（sub-order）、文件（sub-file）、视频（sub-video）、
 * 系统后台（sub-system）是子菜单；密码本是一级平铺项，不需要展开。
 */
function resolveOpenKeys(pathname: string): string[] {
  const openKeys: string[] = [];

  // 家庭相册与个人相册都用 sub-album 这一个 key（同一时刻只渲染一套菜单）
  if (pathname.startsWith('/album')) openKeys.push('sub-album');
  if (pathname.startsWith('/recipe')) {
    // 菜谱与点单管理共用 /recipe 前缀，按二级路径分组，只点亮真正所属的那个
    openKeys.push(isOrderPath(pathname) ? 'sub-order' : 'sub-recipe');
  }
  // 文件/视频各自的两级菜单（全部 + 分组），密码本是一级平铺项、无需展开
  if (pathname.startsWith('/file')) openKeys.push('sub-file');
  if (pathname.startsWith('/video')) openKeys.push('sub-video');
  // 系统后台：账号管理/角色管理/目录管理/变更记录/部署管理/系统日志/操作记录/知识库/后端代码/前端代码/数据库十一项收进 sub-system 这一组
  // （注意 /operation-logs 不以 /logs 开头、/server-repo 不以 /storage 开头，各条各自判断即可，不会互相误命中）
  if (
    pathname.startsWith('/user') ||
    pathname.startsWith('/role') ||
    pathname.startsWith('/storage') ||
    pathname.startsWith('/change-log') ||
    pathname.startsWith('/deploy') ||
    pathname.startsWith('/logs') ||
    pathname.startsWith('/operation-logs') ||
    pathname.startsWith('/knowledge') ||
    pathname.startsWith('/server-repo') ||
    pathname.startsWith('/web-repo') ||
    pathname.startsWith('/database')
  ) {
    openKeys.push('sub-system');
  }

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
  const { domain } = useDomain();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState(() => resolveOpenKeys(location.pathname));
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // 路由变化时展开所属模块；同一路由下尊重手动收起（空数组也是有效状态）。
  useEffect(() => {
    setOpenKeys(resolveOpenKeys(location.pathname));
  }, [location.pathname]);

  // 菜单按「域」+「权限」双重过滤：域决定用哪一套，权限决定每一项露不露（见 familyMenuItems/personalMenuItems）。
  const menuItems: MenuProps['items'] =
    domain === 'PERSONAL' ? personalMenuItems(user) : familyMenuItems(user);

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
          {/* 常驻域牌：固定在菜单滚动区之上，不随菜单滚动走，随时能看到并一键切家庭/个人 */}
          <DomainSwitch collapsed={collapsed} />
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
        {/* 窄屏没有常驻侧栏，域牌放进抽屉顶部：进来先看到当前是家庭/个人，一键切换 */}
        <DomainSwitch onAfterSwitch={() => setDrawerOpen(false)} />
        {menu}
      </Drawer>
    </Layout>
  );
}
