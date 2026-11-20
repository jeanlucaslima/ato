import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

const src = path.resolve(__dirname, 'src')

/**
 * `npm run build` (mode "unpacked") is the copy you load from dist/ while developing.
 * It must sit beside the installed store 2.x build without clashing: its own name,
 * a -dev version label, and ⇧⌘U / Ctrl+Shift+U (Chrome gives ⌘U to whichever
 * extension claimed it first). `npm run build:store` keeps the manifest as written.
 */
function unpackedManifest(json: string): string {
  const manifest = JSON.parse(json)
  manifest.name = 'ATO 3 (dev)'
  manifest.short_name = 'ATO 3 dev'
  manifest.version_name = `${manifest.version}-dev`
  manifest.action.default_title = 'ATO 3 (dev)'
  manifest.commands._execute_action.suggested_key = { default: 'Ctrl+Shift+U', mac: 'Command+Shift+U' }
  return JSON.stringify(manifest, null, 2)
}

export default defineConfig(({ mode }) => ({
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
        options: path.join(src, 'options/index.html'),
        background: path.join(src, 'background/worker.ts'),
      },
      output: {
        // The manifest names the worker by path, so it can't carry a hash.
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background/worker.js' : 'chunks/[name]-[hash].js'),
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.', transform: mode === 'unpacked' ? unpackedManifest : undefined },
        { src: 'assets/icons/*.png', dest: 'assets/icons' },
      ],
    }),
  ],
}))
