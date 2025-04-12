import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { viteStaticCopy } from "vite-plugin-static-copy"
import path from "path"
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Required for __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, "src/sidepanel/index.html"),
        background: path.resolve(__dirname, "src/background/index.ts")
      },
      output: {
        entryFileNames: "[name]/index.js",
        assetFileNames: "[name]/[name].[ext]"
      }
    }
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "assets/icons/*", dest: "icons" }
      ]
    })
  ]
})
