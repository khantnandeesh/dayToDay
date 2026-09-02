import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/lsp': {
        target: 'ws://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});


