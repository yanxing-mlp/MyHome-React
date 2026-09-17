import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * C 端 h5。
 *
 * base 是 '/'：生产由 nginx 把根路径给 C 端，/admin/ 给 B 端（方案 §8.2）。
 *
 * 一期不配 proxy —— C 端不调任何后端接口，home 卡片是前端静态数据（方案 §5.4）。
 * 二期做内页时再把 /api 和 /files 的 proxy 加回来。
 */
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
