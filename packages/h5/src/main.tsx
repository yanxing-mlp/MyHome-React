import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyFavicon } from '@family-home/shared/brand';
import App from './App';
import './index.css';

// 标签页图标与页内 logo 共用 shared 那一份 SVG（原因见 brand/logo.ts）
applyFavicon();

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到 #root 挂载点');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
