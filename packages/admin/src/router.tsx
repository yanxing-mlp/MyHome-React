import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useCurrentUser } from '@family-home/shared/auth';
import { AdminLayout } from './layouts/AdminLayout';
import { HomePage } from './pages/HomePage';
import { GroupListPage } from './pages/album/GroupListPage';
import { ImageGridPage } from './pages/album/ImageGridPage';
import { AllImagesPage } from './pages/album/AllImagesPage';
import { CityDistributionPage } from './pages/album/CityDistributionPage';
import { RecipeListPage } from './pages/recipe/RecipeListPage';
import { RecipeEditPage } from './pages/recipe/RecipeEditPage';
import { CategoryManagePage } from './pages/recipe/CategoryManagePage';
import { PracticeManagePage } from './pages/recipe/PracticeManagePage';
import { OrderListPage } from './pages/recipe/OrderListPage';
import { OrderStatPage } from './pages/recipe/OrderStatPage';
import { DocumentListPage } from './pages/file/DocumentListPage';
import { VideoListPage } from './pages/video/VideoListPage';
import { UserManagePage } from './pages/user/UserManagePage';
import { ProfilePage } from './pages/user/ProfilePage';
import { VaultAccountPage } from './pages/vault/VaultAccountPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * 路由表（方案 §7.3）。
 */
export function AppRoutes() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  // 切范围、账号或分组详情时销毁筛选、勾选与弹窗状态。
  const albumKey = `${user?.id ?? 'anonymous'}:${pathname}`;
  const dataKey = (scope: 'PUBLIC' | 'PRIVATE') => `${user?.id ?? 'anonymous'}:${scope}`;
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        {/* 首页：进 B 端落在这一页，不再 redirect 到某个模块。
            '/' 与 '/home' 都渲染同一个页面：点菜单里的「首页」时 react-router 会把
            basename 后的根路径写成 /admin（没有结尾斜杠），这个 URL 在 dev 和
            nginx `location /admin/` 下刷新都会掉到 base 提示页；所以菜单指向 /home，
            而 '/' 只作为直接访问的入口留着（带斜杠，刷新没问题）。 */}
        <Route index element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />

        {/* 两个独立相册模块共用页面实现，旧个人入口重定向到分组列表。 */}
        <Route path="/album/personal" element={<Navigate to="/album/personal/groups" replace />} />
        <Route path="/album/personal/groups" element={<GroupListPage key={albumKey} scope="PERSONAL" />} />
        <Route path="/album/personal/images" element={<AllImagesPage key={albumKey} scope="PERSONAL" />} />
        <Route path="/album/personal/distribution" element={<CityDistributionPage key={albumKey} scope="PERSONAL" />} />
        <Route path="/album/personal/:groupId" element={<ImageGridPage key={albumKey} scope="PERSONAL" />} />

        <Route path="/album" element={<Navigate to="/album/groups" replace />} />
        <Route path="/album/groups" element={<GroupListPage key={albumKey} scope="FAMILY" />} />
        <Route path="/album/images" element={<AllImagesPage key={albumKey} scope="FAMILY" />} />
        <Route path="/album/distribution" element={<CityDistributionPage key={albumKey} scope="FAMILY" />} />
        <Route path="/album/:groupId" element={<ImageGridPage key={albumKey} scope="FAMILY" />} />

        <Route path="/recipe" element={<RecipeListPage />} />
        <Route path="/recipe/categories" element={<CategoryManagePage />} />
        <Route path="/recipe/practices" element={<PracticeManagePage />} />
        <Route path="/recipe/orders" element={<OrderListPage />} />
        <Route path="/recipe/statistics" element={<OrderStatPage />} />
        <Route path="/recipe/new" element={<RecipeEditPage />} />
        <Route path="/recipe/:id/edit" element={<RecipeEditPage />} />

        {/* 文件管理。刻意用单数 /file：静态资源前缀是 /files，页面路由若也叫 /files，
            在 dev 下会被 vite proxy 抢先匹配（/admin/files → 后端文件目录）而进不了 SPA。 */}
        <Route path="/file" element={<Navigate to="/file/public" replace />} />
        <Route path="/file/public" element={<DocumentListPage key={dataKey('PUBLIC')} scope="PUBLIC" />} />
        <Route path="/file/private" element={<DocumentListPage key={dataKey('PRIVATE')} scope="PRIVATE" />} />

        {/* 视频管理。公共/个人两档，页面路由 /video 不与静态资源前缀 /files 冲突；
            播放走 /admin/api/b/video/{id}/stream（带签名票据），命中 /admin/api 代理。 */}
        <Route path="/video" element={<Navigate to="/video/public" replace />} />
        <Route path="/video/public" element={<VideoListPage key={dataKey('PUBLIC')} scope="PUBLIC" />} />
        <Route path="/video/private" element={<VideoListPage key={dataKey('PRIVATE')} scope="PRIVATE" />} />

        <Route path="/vault" element={<Navigate to="/vault/public" replace />} />
        <Route path="/vault/public" element={<VaultAccountPage key={dataKey('PUBLIC')} scope="PUBLIC" />} />
        <Route path="/vault/private" element={<VaultAccountPage key={dataKey('PRIVATE')} scope="PRIVATE" />} />

        {/* 账号管理：菜单只对 ADMIN 露出，但路由不做条件注册 —— 普通成员直接敲 URL
            也会命中这一页，由页面自己的 403 分支说明原因（服务端每个接口另有一道 requireAdmin）。 */}
        <Route path="/user" element={<UserManagePage />} />

        {/* 个人中心：所有人都能进（包括 MEMBER），服务端那三条 /profile* 只要身份不要角色。 */}
        <Route path="/profile" element={<ProfilePage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
