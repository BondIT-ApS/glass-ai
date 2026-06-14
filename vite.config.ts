import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// G2 glasses load the webview from a URL the companion phone app supplies.
// `base: './'` keeps asset paths relative so the bundle works from any host.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@evenrealities/even_hub_sdk')) return 'even-sdk';
          if (/node_modules\/(react|react-dom|react-router)[/\\]/.test(id)) return 'react';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
