import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite Configuration for Electron App
 *
 * Changes for Electron IPC migration:
 * - Removed proxy configuration (no backend server needed)
 * - React app communicates directly with Electron main process via IPC
 * - Vite dev server only serves the React frontend
 *
 * Production optimizations:
 * - Disabled source maps in production
 * - Enabled asset compression
 * - Configured rollup for better tree-shaking
 * - Optimized chunk sizes
 * - Disabled CSS source maps
 */
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [react()],
    root: './web',
    base: './', // Use relative paths for Electron (file:// protocol)
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      target: 'es2020',
      cssCodeSplit: true,
      cssMinify: isProduction,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
          },
          chunkFileNames: isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js',
          entryFileNames: isProduction ? 'assets/[name]-[hash].js' : 'assets/[name].js',
          assetFileNames: isProduction ? 'assets/[name]-[hash].[ext]' : 'assets/[name].[ext]',
          compact: isProduction,
        },
        treeshake: isProduction
          ? {
              moduleSideEffects: true, // Keep side effects for proper rendering
              propertyReadSideEffects: false,
              tryCatchDeoptimization: false,
            }
          : false,
      },
      assetsInlineLimit: 4096,
      modulePreload: {
        polyfill: false,
      },
    },
    server: {
      port: 3001,
      strictPort: true,
      // Proxy removed - all API calls now use Electron IPC instead of HTTP
      // The React frontend communicates with the main process via window.electronAPI
    },
    preview: {
      port: 3001,
      strictPort: true,
    },
    css: {
      devSourcemap: !isProduction,
      modules: {
        localsConvention: 'camelCase',
      },
    },
    esbuild: {
      drop: isProduction ? ['debugger'] : [], // Keep console for production debugging
      legalComments: 'none',
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: [],
    },
  }
})
