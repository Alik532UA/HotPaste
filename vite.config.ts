import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig(() => ({
  define: {
    '__APP_VERSION__': JSON.stringify(pkg.version),
  },
  base: './',
  plugins: [
    svelte(),
    (() => {
      let isDev = false;
      return {
        name: 'html-transform',
        configResolved(config) {
          isDev = config.command === 'serve';
        },
        transformIndexHtml(html) {
          if (isDev) {
            return html.replace('<title>HotPaste', '<title>HotPaste-dev');
          }
          return html;
        }
      };
    })(),
    VitePWA({
      /*
       * `prompt`, а НЕ `autoUpdate`.
       *
       * `autoUpdate` разом зі `skipWaiting` означає, що новий воркер забирає
       * ВЖЕ ВІДКРИТУ вкладку під себе, а `cleanupOutdatedCaches` прибирає з
       * передкешу старі чанки — тобто сторінка, яка тримає їхні адреси,
       * отримує 404 на перший же лінивий імпорт. Рішення про це ухвалював
       * воркер, а не людина.
       *
       * Тут ціна вища, ніж у звичайному застосунку: у роботі відкрита тека з
       * файлами, і перезавантаження посеред редагування сніпета — це втрачений
       * текст.
       *
       * Крім того, готове вікно `UpdateModal` живиться окремим опитуванням
       * `app-version.json` і про воркер не знало НІЧОГО. Тобто два механізми
       * оновлення працювали паралельно й не узгоджувалися: воркер міняв код
       * під ногами, а вікно повідомляло про версію.
       */
      registerType: 'prompt',
      /*
       * Реєструємо самі (`ReloadPrompt.svelte`), і головне тут не стиль.
       * Вбудована реєстрація вмикається БЕЗУМОВНО, зокрема у вікні застосунку
       * Tauri — а там service worker шкідливий: він закешує вшиту в exe
       * оболонку й віддаватиме її після того, як оновлювач поставить нову
       * версію. Своя реєстрація дає місце для умови.
       */
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        cleanupOutdatedCaches: true,
        // Єдина сторінка застосунку: будь-яка навігація офлайн віддає її.
        navigateFallback: 'index.html',
        // Версія мусить приходити з мережі, інакше перевірка оновлень читає
        // власну кешовану відповідь і завжди бачить «найновішу».
        navigateFallbackDenylist: [/app-version\.json$/],
        dontCacheBustURLsMatching: /-[a-f0-9]{8}\./
      },
      manifest: {
        name: "HotPaste — Менеджер сніпетів",
        short_name: "HotPaste",
        description: "Блискавичний менеджер сніпетів з клавіатурною навігацією",
        lang: "uk",
        theme_color: "#0b0b10",
        background_color: "#0b0b10",
        display: "standalone",
        /*
         * ВІДНОСНІ адреси, а не `/HotPaste/`.
         *
         * Доти тут стояв зашитий шлях GitHub Pages при `base: './'` — тобто
         * маніфест обіцяв одну адресу, а сторінка віддавалася з іншої.
         * Встановлений застосунок відкривався б на чужому шляху, а в Tauri,
         * де схема взагалі не http, `start_url` не мав би сенсу.
         *
         * Відносні значення резолвляться проти адреси самого маніфеста, тож
         * однакові й на Pages, і на власному домені, і в підпапці.
         */
        id: "./",
        scope: "./",
        start_url: "./",
        icons: [
          /*
           * Растрові іконки, а не лише SVG.
           *
           * Доти єдиною іконкою був `favicon.svg` із `purpose: "any maskable"`,
           * і обидві половини були неправдою. По-перше, це піктограма з
           * `stroke="white"` і без заливки — на світлому тлі вона невидима.
           * По-друге, `maskable` означає «у мене є поле безпеки по краях»;
           * у цієї його немає, тож система обрізала б її по колу.
           *
           * Тому PNG і `purpose: "any"`. Заявляти `maskable`, не маючи
           * підготовленої версії, гірше, ніж не заявляти зовсім: без неї
           * система додасть поле сама, з нею — обріже малюнок.
           */
          {
            src: "icon-256.png",
            sizes: "256x256",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      devOptions: {
        enabled: false,
        suppressWarnings: true,
        type: 'module'
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
