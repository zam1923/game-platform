import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    watch: {
      usePolling: true,
      interval: 800,
    },
    proxy: {
      '/api': 'http://localhost:3000',
      '/game': 'http://localhost:3000',
      '/platform.js': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
