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
        'popup/popup': path.resolve(__dirname, 'src/popup/popup.js'),
        'options/options': path.resolve(__dirname, 'src/options/options.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name].js',
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
          src: 'options/options.html',
          dest: 'options'
        },
        {
          src: 'options/options.css',
          dest: 'options'
        },
        {
          src: 'assets/icons/*.png',
          dest: 'assets/icons'
        },
        {
          src: 'assets/icons/ato-logo.svg',
          dest: 'assets/icons'
        }
      ]
    })
  ]
})
