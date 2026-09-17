import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * B 端 admin。
 *
 * base 固定为 '/admin/'：生产由 nginx 用路径区分 B/C 端（方案 §8.2），
 * 开发期也走同一个 base，这样 dev 和 prod 的路由行为完全一致，不会到 M5 才发现路径错。
 * 开发地址是 http://localhost:5173/admin/
 */
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    // workspace 里 shared 也依赖 react，去重避免两份 React 实例导致的 hooks 报错
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // shared 是源码形式（exports 指向 .ts），不要让 esbuild 预打包
    exclude: ['@family-home/shared'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // 开发期靠 proxy 变成同源请求，所以后端不需要配 CORS（方案 §8.1）
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/files': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
