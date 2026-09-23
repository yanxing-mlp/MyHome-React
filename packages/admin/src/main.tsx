import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { applyFavicon } from '@family-home/shared/brand';
import 'dayjs/locale/zh-cn';
import App from './App';
import './index.css';

// 标签页图标与侧栏 logo 共用 shared 那一份 SVG
applyFavicon();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 家庭后台不是高频实时场景，失败重试一次就够，切窗口不自动刷新
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('找不到 #root 挂载点');
}

createRoot(container).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#2f54eb', borderRadius: 8 } }}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
);
