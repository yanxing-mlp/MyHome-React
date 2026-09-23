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
      '/admin/api': { 
        target: 'http://localhost:8080', 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin/, ''),
      },
      '/admin/files': { 
        target: 'http://localhost:8080', 
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin/, ''),
      },
      // 后端返回的资源地址是绝对路径 /files/...（url-prefix=/files），浏览器请求的就是根路径，
      // 不带 /admin 前缀。生产由 nginx 在根上直接服务 /files，dev 必须同样代理这一条，
      // 否则缩略图/文档链接在 dev 下 404（此前只是靠浏览器缓存看起来"能用"）。
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
