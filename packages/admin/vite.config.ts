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
      // admin 的 api 模块用的都是根相对 '/api/b/...'（http.ts baseURL='/'），dev 下由这里代理成同源。
      // 生产是单端口托管：后端 :8080 直接发这份 dist，/api 与前端同源，不需要任何代理（方案 v57 §8.2）。
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // 后端返回的资源地址是绝对路径 /files/...（url-prefix=/files），浏览器请求的就是根路径。
      // dev 必须同样代理这一条，否则缩略图/文档/视频在 dev 下 404。
      '/files': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
