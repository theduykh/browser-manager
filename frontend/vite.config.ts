import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In Docker, compose sets VITE_BACKEND_URL=http://backend:3000. For host `npm run dev`
// the env is unset, so fall back to the published backend port on localhost.
const backendTarget = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  // noVNC 1.7+ uses top-level await → need es2022+ target.
  build: { target: 'esnext' },
  esbuild: { target: 'esnext' },
  optimizeDeps: {
    include: ['@novnc/novnc'],
    esbuildOptions: { target: 'esnext' },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
    },
    watch: {
      // Windows host ↔ Linux container bind mount: native fs events thường không reach
      usePolling: true,
      interval: 500,
    },
  },
});
