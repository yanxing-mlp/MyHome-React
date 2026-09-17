import { Navigate, Route, Routes } from 'react-router';
import { AdminLayout } from './layouts/AdminLayout';
import { GroupListPage } from './pages/album/GroupListPage';
import { ImageGridPage } from './pages/album/ImageGridPage';
import { RecipeListPage } from './pages/recipe/RecipeListPage';
import { RecipeEditPage } from './pages/recipe/RecipeEditPage';
import { TagManagePage } from './pages/recipe/TagManagePage';
import { TypeManagePage } from './pages/recipe/TypeManagePage';
import { VaultAccountPage } from './pages/vault/VaultAccountPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * 路由表（方案 §7.3）。
 *
 * 注意 /recipe/tags 与 /recipe/types 必须排在 /recipe/:id/edit 之前声明——
 * react-router v7 按声明顺序匹配，否则 "tags" 会被当成 :id 吃掉。
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/album" replace />} />

        <Route path="/album" element={<GroupListPage />} />
        <Route path="/album/:groupId" element={<ImageGridPage />} />

        <Route path="/recipe" element={<RecipeListPage />} />
        <Route path="/recipe/tags" element={<TagManagePage />} />
        <Route path="/recipe/types" element={<TypeManagePage />} />
        <Route path="/recipe/new" element={<RecipeEditPage />} />
        <Route path="/recipe/:id/edit" element={<RecipeEditPage />} />

        <Route path="/vault" element={<VaultAccountPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
