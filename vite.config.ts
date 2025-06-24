import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

// Custom plugin to copy manifest and icons
const copyStaticFiles = () => ({
  name: 'copy-static-files',
  writeBundle() {
    // Copy manifest.json
    copyFileSync('manifest.json', 'dist/manifest.json')
    
    // Copy icons if they exist
    if (existsSync('icons')) {
      if (!existsSync('dist/icons')) {
        mkdirSync('dist/icons', { recursive: true })
      }
      
      const iconSizes = ['16', '32', '48', '128']
      iconSizes.forEach(size => {
        const iconFile = `icons/icon${size}.png`
        if (existsSync(iconFile)) {
          copyFileSync(iconFile, `dist/${iconFile}`)
        }
      })
    }
  }
})

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/service-worker') {
            return 'background/service-worker.js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      },
      external: ['chrome']
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development'
  },
  
  // Copy static files
  publicDir: 'public',
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/sidepanel/components'),
      '@hooks': resolve(__dirname, './src/sidepanel/hooks'),
      '@utils': resolve(__dirname, './src/sidepanel/utils'),
      '@styles': resolve(__dirname, './src/sidepanel/styles')
    }
  },
  
  // Development server (not needed for extension but useful for component development)
  server: {
    port: 3000,
    open: false
  },
  
  // Define globals for Chrome extension APIs
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production'
  },
  
  // Ensure proper handling of Chrome extension context
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background/service-worker') {
            return 'background/service-worker.js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      },
      external: ['chrome']
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development'
  }
})
