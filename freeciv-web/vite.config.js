import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/main/webapp',
  base: '/',
  build: {
    outDir: '../../../target/freeciv-web-vite',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'three-modules': resolve(__dirname, 'src/main/webapp/javascript/three-modules.js'),
      },
      output: {
        entryFileNames: 'javascript/[name]-[hash].js',
        chunkFileNames: 'javascript/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true
      }
    },
    sourcemap: true
  },
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/main/webapp')
    }
  }
});
