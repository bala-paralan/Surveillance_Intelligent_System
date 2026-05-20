import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Backend mounts routes at root (e.g. /auth/login). Strip the /api
      // prefix so the frontend can use a single, environment-agnostic
      // BASE_URL of `/api` (matches the prod nginx config).
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
        rewrite:      (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
