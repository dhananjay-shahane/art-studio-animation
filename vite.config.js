import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: false,
    host: true,
  },
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'esnext',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/animejs')) return 'anime';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
