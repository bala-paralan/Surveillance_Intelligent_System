import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Build config for the GitHub Pages demo (sis-dashboard).
// Boots only the SENTRY shell with mock data — no auth, no backend.
export default defineConfig({
  base: '/sis-dashboard/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-pages',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'sentry.html'),
    },
  },
});
