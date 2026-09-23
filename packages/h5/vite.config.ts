import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * C 端 h5。
 *
 * base 是 '/'：生产由 nginx 把根路径给 C 端，/admin/ 给 B 端（方案 §8.2）。
 *
 * 点餐页开始调后端，所以把 /api 和 /files 的 proxy 加上（一期 C 端不调接口，见方案 §5.4）。
 */
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/files': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
