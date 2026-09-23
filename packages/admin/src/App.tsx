import { BrowserRouter } from 'react-router';
import { App as AntdApp } from 'antd';
import { useCurrentUser } from '@family-home/shared/auth';
import { AppRoutes } from './router';
import { LoginPage } from './pages/LoginPage';
import { useSyncMe } from './features/user/useUsers';

/**
 * basename 与 vite base 必须一致（都是 /admin），
 * 否则生产环境 nginx alias 到 /admin/ 时路由会 404（方案 §8.2）。
 *
 * 【登录门槛放在路由外面】没有当前用户时整棵业务路由树根本不挂载，
 * 所以任何页面都不用自己判断"我登录了吗"，也不存在"接口 401 之后页面空掉"那种中间态。
 * useSyncMe 是"以服务端为准"那一步：本机缓存只是上次登录过谁，昵称/头像/角色可能已被改，
 * 账号被删时 /me 返 401 → http 层清缓存 → 这一行条件立刻把页面换回登录页。
 */
export default function App() {
  const user = useCurrentUser();
  useSyncMe(user?.id);

  return (
    <AntdApp>
      <BrowserRouter basename="/admin">{user ? <AppRoutes /> : <LoginPage />}</BrowserRouter>
    </AntdApp>
  );
}
