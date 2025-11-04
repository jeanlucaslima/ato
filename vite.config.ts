import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'background/service-worker': path.resolve(__dirname, 'src/background/service-worker.js'),
        'popup/popup': path.resolve(__dirname, 'src/popup/popup.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.'
        },
        {
          src: 'popup/popup.html',
          dest: 'popup'
        },
        {
          src: 'popup/popup.css',
          dest: 'popup'
        },
        {
          src: 'assets/icons/*.png',
          dest: 'assets/icons'
        }
      ]
    })
  ]
})
