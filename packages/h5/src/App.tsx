import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { HomePage } from './pages/HomePage';
import { ComingSoonPage } from './pages/ComingSoonPage';

/**
 * C 端一期只有两个路由（方案 §7.3）。
 * basename 与 vite base 一致，都是 '/'。
 */
export default function App() {
  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/coming-soon" element={<ComingSoonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
