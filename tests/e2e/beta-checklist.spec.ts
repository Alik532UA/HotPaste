import { expect, test, type Page } from '@playwright/test'

/**
 * Сторінка чеклиста бета-тестування (BETA-CHECKLIST § 5.7, `BETA-PAGE-E2E`).
 *
 * Кожен сценарій закриває крок, на якому робота тестувальника зникає МОВЧКИ:
 * сторінка лишається намальованою, інваріанти зеленими, а година роботи — ні.
 * Дублювати тут інваріанти над даними немає сенсу — вони червоніють швидше й
 * дешевше.
 */

const PAGE = '/?beta-test-checklists'

/**
 * Перший пункт першої вкладки — і два імені того самого.
 *
 * У сховищі лежить `start_1` (форма `{вкладка}_{номер}`, § 2.2), у розмітці —
 * `start-1`: підкреслень у локаторах немає (TESTID-AND-NAMING § 1.2). Дві
 * константи саме тому, що звіт нижче звіряється з ПЕРШОЮ, а кліки — з другою.
 */
const CHECK = 'start_1'
const TID = CHECK.replace(/_/g, '-')

const progress = (page: Page) => page.getByTestId('beta-progress-value').innerText()

test.beforeEach(async ({ page }) => {
	await page.goto(PAGE)
	await expect(page.getByTestId('beta-progress-value')).toBeVisible()
})

/**
 * Сторінка досяжна БЕЗ підключеної теки, і це головне в її будові.
 *
 * Застосунок до підключення теки показує вітальний екран і нікуди далі не
 * пускає. Чеклист, вбудований усередину, був би недосяжним рівно доти, доки
 * тестувальник не зробить перший пункт цього ж чеклиста.
 */
test('сторінка відкривається без підключеної теки', async ({ page }) => {
	await expect(page.getByTestId('empty-state'), 'показався застосунок, а не чеклист').toHaveCount(0)
	await expect(page.getByTestId('beta-tab-start-btn')).toBeVisible()
	await expect(page.getByTestId('beta-level-manual-section')).toBeVisible()
})

test('позначка переживає перезавантаження', async ({ page }) => {
	const vote = page.getByTestId(`beta-vote-${TID}-ok-btn`)
	await vote.click()
	await expect(vote).toHaveAttribute('aria-pressed', 'true')

	await page.reload()

	await expect(
		page.getByTestId(`beta-vote-${TID}-ok-btn`),
		'позначка не пережила перезавантаження — сесія тестувальника зникає мовчки'
	).toHaveAttribute('aria-pressed', 'true')
})

/**
 * § 3.3 `BETA-VOTE-UNDO`: кнопок три, а станів чотири. Повернення до «не
 * перевірено» робиться повторним натисканням уже натиснутого, інакше єдиний
 * спосіб виправити помилковий клік — стерти все.
 */
test('поступ росте на один, а повторне натискання його знімає', async ({ page }) => {
	const before = await progress(page)
	const vote = page.getByTestId(`beta-vote-${TID}-ok-btn`)

	await vote.click()
	await expect(page.getByTestId('beta-progress-value'), 'поступ не зрушив').not.toHaveText(before)

	await vote.click()
	await expect(
		page.getByTestId('beta-progress-value'),
		'повторне натискання не зняло позначку'
	).toHaveText(before)
})

/** § 8.1: вкладок сім, і загальне число не каже, чи закінчена ця. */
test('лічильник вкладки росте окремо від загального', async ({ page }) => {
	const own = page.getByTestId('beta-tab-start-progress-text')
	const before = await own.innerText()

	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click()

	await expect(own, 'лічильник вкладки не зрушив').not.toHaveText(before)
	await expect(
		page.getByTestId('beta-tab-cards-progress-text'),
		'позначка потрапила в чужу вкладку'
	).toHaveText(/^0\//)
})

test('перемикання вкладки міняє перелік і не губить позначене', async ({ page }) => {
	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click()

	await page.getByTestId('beta-tab-cards-btn').click()
	await expect(
		page.getByTestId(`beta-check-${TID}-item`),
		'пункти чужої вкладки лишилися на екрані'
	).toHaveCount(0)

	await page.getByTestId('beta-tab-start-btn').click()
	await expect(
		page.getByTestId(`beta-vote-${TID}-ok-btn`),
		'позначка загубилася при поверненні на вкладку'
	).toHaveAttribute('aria-pressed', 'true')
})

/**
 * § 6.3 `BETA-CLEAR-TWO-STEP`: стирання — ЄДИНА незворотна дія на сторінці, і
 * стоїть вона в тому самому рядку, що й «Скопіювати звіт», до якого тягнуться
 * щоразу. Ціна помилки несиметрична: година роботи проти зайвого кліка.
 */
test('перше натискання «стерти» нічого не стирає', async ({ page }) => {
	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click()
	const marked = await progress(page)

	await page.getByTestId('beta-clear-btn').click()
	await expect(
		page.getByTestId('beta-progress-value'),
		'одне натискання знесло всю роботу тестувальника'
	).toHaveText(marked)

	await page.getByTestId('beta-clear-btn').click()
	await expect(page.getByTestId('beta-progress-value')).not.toHaveText(marked)
})

/**
 * Запасний шлях (§ 6.2) із НАВМИСНО зламаним буфером.
 *
 * Просто «не давати дозволу» не досить: у headless Chromium `writeText` після
 * цього однаково спрацьовує, і сторінка йде гілкою успіху — тобто перевірка
 * запасного шляху перевіряла б не його, а те, що кнопка є. Перевіряється саме
 * локатор ВІДМОВИ (§ 6.2.1), бо спільний зеленів би в обох випадках.
 */
test('звіт доходить до людини навіть без буфера обміну', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: () => Promise.reject(new Error('clipboard blocked in test')) }
		})
	})
	await page.reload()

	await page.getByTestId(`beta-vote-${TID}-fail-btn`).click()
	await page.getByTestId('beta-report-btn').click()

	await expect(page.getByTestId('beta-report-failed-hint')).toBeVisible()

	const field = page.getByTestId('beta-report-input')
	await expect(field, 'у звіті немає позначеного пункта').toHaveValue(new RegExp(CHECK))
	await expect(field, 'у звіті немає версії збірки').toHaveValue(/\d+\.\d+\.\d+/)
	// Підпис іде мовою чеклиста, і вона тут — мова застосунку: «оболонка» в
	// українській, `shell` в англійській. Перевіряється значення, а не переклад.
	await expect(field, 'у звіті немає оболонки — а від неї залежить частина пунктів').toHaveValue(
		/(оболонка|shell): (tauri|browser)/
	)
	await expect(field, 'у звіті немає теми — а половина пунктів про кольори').toHaveValue(
		/(тема|theme): \S+/
	)
})

/**
 * § 8.5.1 `BETA-VERSION-VISIBLE` і § 8.4 `BETA-SCREEN-LINKS`.
 *
 * Версія відповідає на «чи рахується моя позначка»; перелік екранів знімає
 * найдовший крок у роботі — прочитав пункт, шукає, де це в застосунку. Вихід
 * потрібен тому, що тестувальник приходить за прямим посиланням і повернутися
 * в застосунок йому інакше нічим.
 */
test('на сторінці видно версію, екрани вкладки й вихід', async ({ page }) => {
	await expect(page.getByTestId('beta-version-text')).toHaveText(/\d+\.\d+\.\d+/)

	const screens = page.locator('[data-testid^="beta-screen-"]')
	expect(await screens.count(), 'вкладка не показала жодного екрана').toBeGreaterThan(0)

	const home = page.getByTestId('beta-home-link')
	await expect(home, 'зі службової сторінки нема куди піти').toHaveAttribute('href', /.+/)
	await home.click()
	await expect(page.getByTestId('beta-progress-value'), 'вихід не повернув у застосунок').toHaveCount(
		0
	)
})
