import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/v1': 'http://127.0.0.1:3001',
      '/healthz': 'http://127.0.0.1:3001',
    },
  },
});
