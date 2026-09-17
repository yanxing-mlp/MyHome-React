import { BrowserRouter } from 'react-router';
import { AppRoutes } from './router';

/**
 * basename 与 vite base 必须一致（都是 /admin），
 * 否则生产环境 nginx alias 到 /admin/ 时路由会 404（方案 §8.2）。
 */
export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AppRoutes />
    </BrowserRouter>
  );
}
