import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/api':  { target: 'http://localhost:3001', changeOrigin: true }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          http:   ['axios']
        }
      }
    },
    sourcemap: false,
    minify: 'esbuild'
  }
});
