import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@background': fileURLToPath(new URL('./src/background', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@popup': fileURLToPath(new URL('./src/popup', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL('./src/popup/index.html', import.meta.url)),
      },
    },
    // 使用 esbuild 压缩（Vite 默认）
    minify: 'esbuild',
  },
  esbuild: {
    // 生产环境移除 debugger
    drop: ['debugger'],
    // 仅移除 console.log/debug/info，保留 console.error/warn 以便排查线上问题
    pure: ['console.log', 'console.debug', 'console.info'],
  },
});
