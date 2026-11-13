import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

const src = path.resolve(__dirname, 'src')

export default defineConfig({
  root: src,
  publicDir: false,
  server: {
    // `npm run dev` opens the screen gallery: every popup state rendered from fixtures.
    open: '/dev/screens.html',
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'chunks',
    rollupOptions: {
      input: {
        popup: path.join(src, 'popup/index.html'),
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'assets/icons/*.png', dest: 'assets/icons' },
      ],
    }),
  ],
})
