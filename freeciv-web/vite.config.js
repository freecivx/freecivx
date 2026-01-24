import { defineConfig } from 'vite'
import { resolve } from 'path'
import viteConcatPlugin from './vite-concat-plugin.js'

export default defineConfig({
  root: 'src',
  plugins: [viteConcatPlugin()],
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
        // Use IIFE format - the unwrap-bundle.js script will unwrap it to execute in global scope
        format: 'iife',
        // Map external 'three' module to global THREE variable
        globals: {
          three: 'THREE'
        }
      },
      // External dependencies that should not be bundled
      // three.js is loaded externally via import maps in index.jsp
      external: ['three']
    },
    // Target ES2019 to match closure compiler settings
    target: 'es2019',
    minify: 'terser',
    terserOptions: {
      ecma: 2019,
      compress: {
        passes: 2
      },
      mangle: {
        // Do not mangle global function names to keep them accessible
        keep_fnames: true,
        reserved: []  // We can add specific function names here if needed
      },
      format: {
        // Preserve some formatting for debugging
        comments: false
      }
    }
  },
  // Configure Vite server for development
  server: {
    port: 3000
  }
})
