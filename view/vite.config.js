import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const rootPackageJsonPath = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../package.json')
const rootPackage = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8'))
const appVersion = rootPackage.version || '0.0.0'
const appTitleWithVersion = `IdeaStudio v${appVersion}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    {
      name: 'inject-root-version-into-title',
      transformIndexHtml(html) {
        if (/<title>.*<\/title>/i.test(html)) {
          return html.replace(
            /<title>.*<\/title>/i,
            `<title>${appTitleWithVersion}</title>`,
          )
        }
        return html.replace(
          /<\/head>/i,
          `  <title>${appTitleWithVersion}</title>\n  </head>`,
        )
      },
    },
  ],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:27123',
      '/renders': 'http://127.0.0.1:27123',
      '/metadata': 'http://127.0.0.1:27123',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
