import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // '@' 指向 src 目录，与 tsconfig 的 paths 保持一致
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 9001,
    proxy: {
      // /api 前缀请求代理到后端，浏览器侧同源，无跨域问题
      '/api': {
        target: 'http://localhost:9000', // 后端 dotnet run 监听地址（launchSettings.json）
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../k_config_center/wwwroot', // 构建产物输出到后端静态目录，单一应用部署
    emptyOutDir: true,
  },
});
