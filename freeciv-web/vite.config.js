import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../target/vite-build',
    emptyOutDir: true,
    // Generate sourcemap
    sourcemap: true,
    rollupOptions: {
      input: {
        webclient: resolve(__dirname, 'src/vite-entry.js')
      },
      output: {
        entryFileNames: 'webclient-vite.min.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Use IIFE format for compatibility with regular script tags
        format: 'iife',
        // Define globals for external dependencies
        globals: {
          three: 'THREE'
        }
      },
      // External dependencies that should not be bundled
      external: ['three']
    },
    // Target ES2019 to match closure compiler settings
    target: 'es2019',
    minify: 'terser',
    terserOptions: {
      ecma: 2019,
      compress: {
        passes: 2
      }
    }
  },
  // Configure Vite server for development
  server: {
    port: 3000
  }
})
