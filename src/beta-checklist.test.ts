// @vitest-environment node
// Перевірка читає дані й джерела — DOM їй не потрібен.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
	ALL_CHECKS,
	BETA_TABS,
	BETA_UNCOVERED_SCREENS,
	LEVELS,
	tidOf,
	type Coverage
} from './lib/beta/checks'
import { TAB_CODES, QWERTY_CODES } from './lib/utils/keyboardLayout'

/**
 * Інваріанти чеклиста бета-тестування (BETA-CHECKLIST § 5).
 *
 * ## Навіщо перевіряти список для людини машиною
 *
 * Найдорожча пастка чеклистів — не помилка в пункті, а ВІДСТАВАННЯ: код
 * змінився, пункт лишився, і людина ставить «перевірено» на тому, чого вже
 * немає. У джерелі канону такий пункт прожив 46 комітів, і причина, чому цього
 * не побачила жодна перевірка, важливіша за сам пункт: поле `testid` було
 * необовʼязкове. Автор шукав локатор, не знайшов, прибрав поле — і пункт став
 * неперевірним. Перевірка мовчала не тому, що помилилася, а тому, що її
 * позбавили входу.
 *
 * Тому тут `testid` обовʼязковий скрізь, де в тексті є «натисніть», а там, де
 * натискають КЛАВІШУ, обовʼязкове поле `key` — і обидва звіряються з кодом.
 *
 * ## Чого тут немає і чому
 *
 * § 4 (noindex, sitemap, `Disallow`) і § 5.5 (скрипт над `build/`) — про
 * індексацію сайту. Тут сайту немає: застосунок віконний, HTML один на обидві
 * сторінки, індексувати нічого. Це відхилення ЗА ПРОФІЛЕМ, і воно записане в
 * докблоці `src/main.ts` разом із причиною.
 */

const ROOT = process.cwd()

const walk = (dir: string, out: string[] = []): string[] => {
	for (const entry of readdirSync(dir)) {
		if (['node_modules', 'dist', '.git'].includes(entry)) continue
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) walk(full, out)
		else out.push(full.replace(/\\/g, '/'))
	}
	return out
}

const SVELTE_FILES = walk('src').filter((file) => file.endsWith('.svelte'))
const MARKUP = SVELTE_FILES.map((file) => readFileSync(file, 'utf8')).join('\n')

const PAGE_SOURCE = readFileSync('src/lib/components/beta/BetaChecklist.svelte', 'utf8')

/**
 * Та сама сторінка БЕЗ коментарів.
 *
 * Сканер, який не знімає коментарі, бреше в обидва боки: він червоніє від
 * власного пояснення («роль `tab` — обіцянка цілого віджета») і так само
 * пропустив би порушення, закоментоване поруч із живим кодом. Тому там, де
 * перевіряється ВІДСУТНІСТЬ чогось, дивиться саме цей рядок.
 */
const PAGE_CODE = PAGE_SOURCE.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
const APP_SOURCE = readFileSync('src/App.svelte', 'utf8')
const HOTKEYS_SOURCE = readFileSync('src/lib/stores/hotkeyState.svelte.ts', 'utf8')

/**
 * Локатори збираються так, як їх збирає БРАУЗЕР, а не як записані (§ 5.3).
 *
 * Тут вони бувають складені: `SegmentedToggle` малює
 * `data-testid={`segmented-opt-${id}-${opt.id}`}`, а `id` приходить пропом —
 * рядка `segmented-opt-theme-dark-gray` немає ніде. Без цього кроку пункт, який
 * назве СПРАВЖНІЙ локатор, падав би, і автора тягло б прибрати поле; а пункт
 * без локатора не перевіряється взагалі, тобто надмірна суворість оберталася б
 * діркою.
 */
const starred = (id: string) => id.replace(/\$?\{[^}]*\}/g, '*')

const KNOWN_LOCATORS: string[] = [
	...new Set(
		[
			...MARKUP.matchAll(/data-testid=(?:"([^"]*)"|\{`([^`]*)`\})/g),
			...MARKUP.matchAll(/data-testid=\{([^}]*'[^}]*)\}/g)
		].map((m) => starred(m[1] ?? m[2] ?? ''))
	)
].filter(Boolean)

/** Чи є в розмітці локатор, який пункт назвав (зірка з обох боків — шаблон). */
const locatorExists = (named: string): boolean =>
	KNOWN_LOCATORS.some((known) => {
		const pattern = new RegExp(
			`^${known
				.split('*')
				.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('.*')}$`
		)
		const namedPattern = new RegExp(
			`^${named
				.split('*')
				.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('.*')}$`
		)
		return pattern.test(named) || namedPattern.test(known)
	})

/**
 * Клавіші, які застосунок СПРАВДІ обробляє, — із самих обробників (§ 5.3.1).
 *
 * Береться з коду, а не з переліку, який ведуть поруч: перелік розійшовся б із
 * обробниками так само, як пункт чеклиста розходиться з екраном, і інваріант
 * почав би доводити узгодженість двох списків замість узгодженості списку з
 * дійсністю.
 */
const HANDLED_KEYS = new Set<string>([
	...[...HOTKEYS_SOURCE.matchAll(/(?:event\.code|code)\s*===\s*'([A-Za-z0-9]+)'/g)].map(
		(m) => m[1]
	),
	// `isTabHotkey` і `isCardHotkey` — теж обробники, лише через перелік кодів.
	...(HOTKEYS_SOURCE.includes('isTabHotkey(') ? TAB_CODES : []),
	...(HOTKEYS_SOURCE.includes('isCardHotkey(') ? QWERTY_CODES : [])
])

/**
 * Екрани, які `App.svelte` справді малює на верхньому рівні (§ 5.1).
 *
 * Читається РОЗМІТКА, а не весь файл: у `script` лежать типи (`HTMLElement`) і
 * назви, які на екран не потрапляють. І окремо відкидаються піктограми з
 * `lucide-svelte`: вони теж пишуться з великої літери й теж стоять у розмітці,
 * але екраном не є — окремий пункт чеклиста «чи намальована шестерня» був би
 * роботою без наслідку.
 */
const APP_MARKUP = APP_SOURCE.slice(APP_SOURCE.indexOf('</script>')).replace(
	/<!--[\s\S]*?-->/g,
	''
)

const ICON_NAMES = new Set(
	[...APP_SOURCE.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-svelte['"]/g)]
		.flatMap((m) => m[1].split(','))
		.map((name) => name.trim())
		.filter(Boolean)
)

const SCREENS_ON_DISK: string[] = [
	...new Set([...APP_MARKUP.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]))
].filter((name) => !ICON_NAMES.has(name))

/** Внутрішні назви, яких людина, що згодилася потикати застосунок, не знає. */
const INTERNAL_WORDS = [
	'testid',
	'localstorage',
	'$state',
	'.svelte',
	'.ts',
	'локатор',
	'сховищ',
	'синглтон',
	'рантайм'
]

describe('чеклист бета-тестування', () => {
	it('перевірка жива: вкладки, пункти, локатори й екрани зібрано', () => {
		// Порожній набір зробив би половину інваріантів тотожними «завжди так».
		expect(BETA_TABS.length).toBeGreaterThanOrEqual(5)
		expect(ALL_CHECKS.length).toBeGreaterThanOrEqual(30)
		expect(KNOWN_LOCATORS.length).toBeGreaterThan(100)
		expect(SCREENS_ON_DISK.length).toBeGreaterThan(10)
		expect(HANDLED_KEYS.size).toBeGreaterThan(10)
	})

	/**
	 * ГОЛОВНИЙ інваріант, адаптований під профіль: новий екран без пунктів валить
	 * прогін. Вкладка називає ЕКРАНИ, а не «застосунок» словами, бо перелік
	 * екранів уже є на диску — без нього екрана просто не буде.
	 */
	it('кожен екран заявлений рівно однією вкладкою (§ 5.1)', () => {
		const claimed = new Map<string, string[]>()
		for (const tab of BETA_TABS) {
			for (const screen of tab.screens) {
				claimed.set(screen, [...(claimed.get(screen) ?? []), tab.id])
			}
		}

		const uncovered = SCREENS_ON_DISK.filter(
			(screen) => !claimed.has(screen) && !BETA_UNCOVERED_SCREENS.includes(screen)
		)
		expect(uncovered, `екран є, а перевіряти його нічим: ${uncovered.join(', ')}`).toEqual([])

		const twice = [...claimed].filter(([, tabs]) => tabs.length > 1)
		expect(twice.map(([screen]) => screen), 'екран заявлено двічі').toEqual([])

		// Дзеркальна половина: вкладка не має права називати екран, якого немає.
		const ghosts = [...claimed.keys()].filter(
			(screen) => !SCREENS_ON_DISK.includes(screen) && !existsSync(`src/lib/components/${screen}.svelte`)
		)
		expect(ghosts, `вкладка заявляє екран, якого немає: ${ghosts.join(', ')}`).toEqual([])
	})

	it('covered називає файл тесту, і файл існує (§ 5.2)', () => {
		const missing = ALL_CHECKS.filter((c) => c.test && !existsSync(join(ROOT, c.test))).map(
			(c) => `${c.id} → ${c.test}`
		)
		expect(missing, `твердження про покриття гниє швидше за сам пункт: ${missing.join(', ')}`).toEqual(
			[]
		)

		const coveredWithoutTest = ALL_CHECKS.filter((c) => c.coverage === 'covered' && !c.test)
		expect(coveredWithoutTest.map((c) => c.id), 'covered без назви файлу').toEqual([])

		const testWithoutCovered = ALL_CHECKS.filter((c) => c.test && c.coverage !== 'covered')
		expect(
			testWithoutCovered.map((c) => c.id),
			'пункт називає тест, але оголошений непокритим — одне з двох неправда'
		).toEqual([])
	})

	it('пункт, що просить натиснути, називає локатор або клавішу (§ 5.3)', () => {
		const naked = ALL_CHECKS.filter((c) => /натисн/i.test(c.text.uk))
			.filter((c) => !c.testid && !c.key)
			.map((c) => c.id)
		expect(naked, `неперевірний за побудовою: ${naked.join(', ')}`).toEqual([])
	})

	it('названий локатор справді є в розмітці (§ 5.3)', () => {
		const ghosts = ALL_CHECKS.filter((c) => c.testid && !locatorExists(c.testid)).map(
			(c) => `${c.id} → ${c.testid}`
		)
		expect(ghosts, `локатора немає в жодному компоненті: ${ghosts.join(', ')}`).toEqual([])
	})

	/**
	 * § 5.3.1 `BETA-SHORTCUT-CLAIMED`.
	 *
	 * `testid` закриває «натисніть кнопку» й нічого не каже про «натисніть
	 * пробіл», а це той самий пункт із тією самою хворобою: комбінацію
	 * перевісили, пункт лишився, і тестувальник тисне те, чого немає. Для цього
	 * застосунку правило не теоретичне: клавіатура — його головний спосіб
	 * керування, і половина пунктів саме про неї.
	 */
	it('названу клавішу застосунок справді обробляє (§ 5.3.1)', () => {
		const deaf = ALL_CHECKS.filter((c) => c.key && !HANDLED_KEYS.has(c.key)).map(
			(c) => `${c.id} → ${c.key}`
		)
		expect(deaf, `пункт просить натиснути клавішу, якої ніхто не слухає: ${deaf.join(', ')}`).toEqual(
			[]
		)
	})

	it('id унікальні й мають форму {вкладка}_{номер} (§ 2.2)', () => {
		const seen = new Map<string, number>()
		for (const check of ALL_CHECKS) seen.set(check.id, (seen.get(check.id) ?? 0) + 1)
		expect([...seen].filter(([, n]) => n > 1).map(([id]) => id), 'однакові id').toEqual([])

		const wrong = BETA_TABS.flatMap((tab) =>
			tab.checks.filter((c) => !new RegExp(`^${tab.id}_\\d{1,3}$`).test(c.id)).map((c) => c.id)
		)
		expect(wrong, 'id не за формою {вкладка}_{номер}').toEqual([])
	})

	/**
	 * § 5.6 `BETA-LOCATOR-PER-CHECK` + TESTID-AND-NAMING § 1.2.
	 *
	 * Місце, де `id` переходить у локатор, — рівно те, де два правила канону
	 * розходяться: `id` має форму `{вкладка}_{номер}`, а в локаторі підкреслень
	 * немає. У шести реалізаціях із десяти це місце не дивився ніхто.
	 */
	it('локатор пункта виходить із id чистим, без підкреслень (§ 5.6)', () => {
		const inPage = [...PAGE_SOURCE.matchAll(/data-testid="(beta-[^"]*)"/g)].map((m) => m[1])
		expect(inPage.length, 'перевірка мертва: локаторів не знайдено').toBeGreaterThan(5)

		expect(
			inPage.filter((id) => /\{\s*check\.id\s*\}/.test(id)),
			'локатор бере check.id без переведення в kebab-case'
		).toEqual([])
		expect(inPage.filter((id) => id.includes('_')), 'підкреслення в локаторі').toEqual([])

		// І сам перехід: `tidOf` повна заміна в обидва боки.
		expect(ALL_CHECKS.filter((c) => tidOf(c.id).includes('_'))).toEqual([])
	})

	it('тексти й категорії непорожні двома мовами, і переклад зроблено (§ 2.4)', () => {
		const bad: string[] = []
		for (const check of ALL_CHECKS) {
			for (const [field, value] of [
				['text', check.text],
				['category', check.category]
			] as const) {
				if (!value.uk.trim() || !value.en.trim()) bad.push(`${check.id}: порожнє ${field}`)
				// Кирилиця в англійському полі — забутий переклад, якого ТИП не бачить.
				if (/[а-яїєґі]/i.test(value.en)) bad.push(`${check.id}: en-${field} кирилицею`)
				if (!/[а-яїєґі]/i.test(value.uk)) bad.push(`${check.id}: uk-${field} без кирилиці`)
			}
		}
		expect(bad, bad.join('\n')).toEqual([])
	})

	/**
	 * Один вид апострофа. Два різні ламають пошук по чеклисту — а шукати в ньому
	 * доводиться щоразу, коли зі звіту треба знайти пункт за словом.
	 */
	it('в українському тексті один вид апострофа (§ 5.4)', () => {
		const wrong = ALL_CHECKS.filter(
			(c) => /['`ʼ]/.test(c.text.uk) || /['`ʼ]/.test(c.category.uk)
		).map((c) => c.id)
		expect(wrong, `не той апостроф (мусить бути ’): ${wrong.join(', ')}`).toEqual([])
	})

	it('у кожній вкладці є робота для людини і є межа (§ 2.3, § 5.4)', () => {
		const noManual = BETA_TABS.filter((tab) => !tab.checks.some((c) => c.coverage === 'manual'))
		expect(
			noManual.map((t) => t.id),
			'вкладка, де все покрито машиною, марнує час людини'
		).toEqual([])

		const noBoundary = BETA_TABS.filter((tab) => !tab.checks.some((c) => c.negative))
		expect(
			noBoundary.map((t) => t.id),
			'немає пункта-межі: ліміт, який перестав діяти, виглядає так само, як ліміт, що діє'
		).toEqual([])
	})

	it('пункт-межа справді формулює заборону', () => {
		const toothless = ALL_CHECKS.filter((c) => c.negative)
			.filter((c) => !/\bНЕ\b|не мусить|немає|жодн|зупинитися|далі не/i.test(c.text.uk))
			.map((c) => c.id)
		expect(toothless, `позначений межею, а нічого не забороняє: ${toothless.join(', ')}`).toEqual([])
	})

	it('текст не починається з номера й не називає внутрішнього (§ 2.1, § 2.2)', () => {
		const numbered = ALL_CHECKS.filter((c) => /^\s*\d+[.)]/.test(c.text.uk)).map((c) => c.id)
		expect(numbered, 'номер малює сторінка з позиції').toEqual([])

		const internal = ALL_CHECKS.filter((c) =>
			INTERNAL_WORDS.some((word) => c.text.uk.toLowerCase().includes(word))
		).map((c) => c.id)
		expect(internal, `внутрішня назва в тексті для людини: ${internal.join(', ')}`).toEqual([])
	})

	it('рівень пункта — один із трьох, і порядок показу сталий (§ 3)', () => {
		expect([...LEVELS]).toEqual(['manual', 'testable', 'covered'])
		const unknown = ALL_CHECKS.filter((c) => !LEVELS.includes(c.coverage as Coverage)).map((c) => c.id)
		expect(unknown).toEqual([])
	})

	/**
	 * § 3.4 `BETA-LEVEL-BALANCE`.
	 *
	 * Контрольна група корисна доти, доки вона лишається групою, а не списком:
	 * `covered` дописують тому, що «тест же є», а не тому, що людині варто це
	 * перевіряти, — і тоді пів години її часу йде туди, де тест уже дивиться.
	 */
	it('у вкладці covered не переважає manual (§ 3.4)', () => {
		const skewed = BETA_TABS.map((tab) => {
			const n = (level: Coverage) => tab.checks.filter((c) => c.coverage === level).length
			return { id: tab.id, manual: n('manual'), covered: n('covered') }
		}).filter((row) => row.covered > row.manual)

		expect(
			skewed.map((r) => `${r.id}: covered ${r.covered} > manual ${r.manual}`),
			'контрольна група більша за роботу'
		).toEqual([])
	})

	/**
	 * § 8.5 `BETA-VERSION-SINGLE-SOURCE` і § 8.5.1 `BETA-VERSION-VISIBLE`.
	 *
	 * Версія, вписана руками, розсинхронізується з релізом — і починає брехати
	 * саме там, де від неї залежить сенс УСІХ позначок одразу. А версія, якої не
	 * видно, робить підказку «позначено на іншій версії» докором без інструкції.
	 */
	it('версія береться з єдиного джерела і видима на сторінці (§ 8.5)', () => {
		const marks = readFileSync('src/lib/beta/marks.svelte.ts', 'utf8')
		expect(marks, 'версія не з єдиного джерела').toContain('__APP_VERSION__')
		expect(marks, 'версія вписана літералом').not.toMatch(/VERSION\s*=\s*['"]\d/)
		expect(PAGE_SOURCE).toContain('data-testid="beta-version-text"')
	})

	/**
	 * § 8.1, § 8.2, § 8.4, § 6.2.1 — те, що сторінка мусить МАТИ.
	 *
	 * Кожен локатор тут закриває крок, на якому робота тестувальника зникає
	 * мовчки або стає непотрібно довгою.
	 */
	it('сторінка має поступ вкладки, екрани, вихід і дві підказки звіту', () => {
		expect(PAGE_SOURCE, 'поступ окремої вкладки').toContain('-progress-text')
		expect(PAGE_SOURCE, 'перелік екранів вкладки').toContain('data-testid="beta-screen-')
		expect(PAGE_SOURCE, 'вихід зі сторінки').toContain('data-testid="beta-home-link"')
		expect(PAGE_SOURCE, 'підказка успіху').toContain('data-testid="beta-report-hint"')
		expect(PAGE_SOURCE, 'підказка відмови буфера').toContain('data-testid="beta-report-failed-hint"')
		expect(PAGE_SOURCE, 'запасне поле звіту').toContain('data-testid="beta-report-input"')

		// § 8.2: смужка вкладок — перемикачі, а не оголошений і не зроблений віджет.
		expect(PAGE_CODE, 'роль таба без віджета').not.toContain('role="tab')
		expect(PAGE_CODE, 'стан вкладки не оголошений читалці').toContain('aria-pressed')
	})

	/**
	 * § 4: сторінка не мусить бути в жодному переліку самого застосунку.
	 *
	 * «Прихована» тут означає рівно одне — шляху до неї з інтерфейсу немає, і
	 * випадково на неї не потрапляють. Це НЕ таємниця: адреса працює завжди, і
	 * її дають посиланням тому, хто згодився допомогти.
	 */
	it('до сторінки не веде жодне посилання з інтерфейсу (§ 4)', () => {
		const leaks = SVELTE_FILES.filter(
			(file) => !file.includes('/beta/') && readFileSync(file, 'utf8').includes('beta-test-checklists')
		)
		expect(leaks, `на службову сторінку веде посилання: ${leaks.join(', ')}`).toEqual([])
	})
})
