import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}']
      },
      manifest: {
        name: "HotPaste — Менеджер сніпетів",
        short_name: "HotPaste",
        description: "Блискавичний менеджер сніпетів з клавіатурною навігацією",
        theme_color: "#0b0b10",
        background_color: "#0b0b10",
        display: "standalone",
        start_url: "/HotPaste/",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-svelte')) return 'vendor-icons';
            if (id.includes('zod')) return 'vendor-validation';
            return 'vendor';
          }
        }
      }
    }
  }
}))
