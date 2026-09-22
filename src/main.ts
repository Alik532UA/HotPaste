import { mount } from 'svelte'
import './app.css'
import './styles/fonts.css'
import App from './App.svelte'
import BetaChecklist from './lib/components/beta/BetaChecklist.svelte'

/**
 * АДРЕСА СЛУЖБОВОЇ СТОРІНКИ (BETA-CHECKLIST § 4).
 *
 * Довга назва замість короткої `beta-test` — з однієї причини, і вона про
 * однозначність, а не про таємницю: `beta-test` читається як «сторінка, де
 * тестують якусь бета-механіку», тобто як пісочниця. `beta-test-checklists` не
 * читається ніяк інакше.
 *
 * ## Чому параметр, а не окрема сторінка
 *
 * Тут немає маршрутизатора: `index.html` один, і другий HTML-вхід означав би
 * другий інлайн-скрипт теми, другий набір шрифтів і другий хеш у політиці
 * безпеки — тобто вдвічі більше місць, де вони розійдуться. Параметр дає ту
 * саму однозначну адресу й не додає жодного з цих місць.
 *
 * ## Чому гілка ТУТ, а не всередині `App.svelte`
 *
 * `App.svelte` до підключення теки показує вітальний екран і не пускає далі
 * нікуди. Тестувальник, якому дали посилання, теки ще не підключав — і чеклист,
 * вбудований усередину застосунку, був би для нього недосяжним рівно доти, доки
 * він не зробить перший пункт цього ж чеклиста.
 *
 * ## Чого тут немає і чому
 *
 * `noindex`, sitemap і `Disallow` (§ 4) — це про індексацію сайту, а тут сайту
 * немає: застосунок віконний, а його веб-оболонка лежить за адресою, яку ніхто
 * не публікує. Скрипт над `build/` (§ 5.5) з тієї ж причини незастосовний:
 * перевіряти в зібраному HTML нічого, бо HTML один на обидві сторінки.
 */
const CHECKLIST_PARAM = 'beta-test-checklists'

const showsChecklist = new URLSearchParams(window.location.search).has(CHECKLIST_PARAM)

const app = mount(showsChecklist ? BetaChecklist : App, {
  target: document.getElementById('app')!,
})

export default app
