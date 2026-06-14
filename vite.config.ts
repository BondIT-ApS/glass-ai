import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// G2 glasses load the webview from a URL the companion phone app supplies.
// `base: './'` keeps asset paths relative so the bundle works from any host.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'even-sdk': ['@evenrealities/even_hub_sdk'],
          react: ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
