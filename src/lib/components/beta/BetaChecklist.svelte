<script lang="ts">
	import { onDestroy } from 'svelte';
	import { BETA_TABS, LEVELS, byLevel, tidOf, type BetaTab, type Coverage } from '../../beta/checks';
	import { betaMarks, VERSION, type Vote } from '../../beta/marks.svelte';
	import { buildReport } from '../../beta/report';
	import { language } from '../../i18n/language.svelte';
	import { theme } from '../../states/ThemeState.svelte';
	import { isTauri } from '../../utils/runtime';

	/**
	 * Сторінка чеклиста бета-тестування (BETA-CHECKLIST § 8).
	 *
	 * ## Чому вона монтується ОКРЕМО від застосунку
	 *
	 * `App.svelte` до підключення теки показує вітальний екран і не пускає далі
	 * нікуди. Тестувальник, якому дали посилання, теки ще не підключав — і
	 * чеклист, вбудований усередину застосунку, був би для нього недосяжним
	 * рівно доти, доки він не зробить перший пункт цього ж чеклиста.
	 *
	 * Тому `main.ts` дивиться на адресу до монтування й піднімає або застосунок,
	 * або цю сторінку. Заодно вона не платить за стан застосунку й не може його
	 * зламати.
	 *
	 * ## Мова
	 *
	 * Кнопки мови тут НЕМАЄ, і це вибір за правилом (§ 8.3): мов інтерфейсу дві,
	 * рівно стільки ж, скільки в чеклиста, тож він іде за мовою застосунку й
	 * тупика «бачу англійську, перемкнути нічим» не буває.
	 */

	let tab = $state<BetaTab>(BETA_TABS[0]);
	let copied = $state(false);
	let fallback = $state('');

	const uk = $derived(language.current === 'uk');
	const say = (u: string, e: string) => (uk ? u : e);

	betaMarks.load();

	/*
	 * Таймера підпису «скопійовано» тут НЕМАЄ (§ 7.5).
	 *
	 * Підпис стоїть до наступної дії й зникає разом зі станом, який його
	 * породив, — тобто витікати нема чому. Це не лінощі: підпис, що гасне сам,
	 * вимагає дивитися на нього в ту саму секунду, а тестувальник у цю мить уже
	 * переклеює звіт у месенджер.
	 *
	 * Єдиний стан, який мусить згаснути сам, — зведена кнопка стирання, і її
	 * таймер живе в сервісі разом із власним прибиранням.
	 */
	onDestroy(() => betaMarks.disarmClear());

	/** Номер наскрізний по ВКЛАДЦІ, а не з одиниці в кожному рівні (§ 2.2). */
	const offsetOf = (level: Coverage) =>
		LEVELS.slice(0, LEVELS.indexOf(level)).reduce(
			(sum, before) => sum + byLevel(tab, before).length,
			0
		);

	const levelName = (level: Coverage) =>
		({
			manual: say('Тільки людина', 'A person only'),
			testable: say('Можна покрити тестом', 'Could be tested'),
			covered: say('Покрито тестом', 'Covered by a test')
		})[level];

	const levelHint = (level: Coverage) =>
		({
			manual: say(
				'Машина цього не побачить. Починайте звідси.',
				'No machine can see this. Start here.'
			),
			testable: say(
				'Тесту поки немає — це перелік того, який варто написати.',
				'No test yet — this is the backlog of tests worth writing.'
			),
			covered: say(
				'Тест це вже перевіряє. Помилка тут означає дефект ТЕСТА, і це важливіше за звичайний баг.',
				'A test already checks this. A failure here is a defect in the TEST, which matters more than a plain bug.'
			)
		})[level];

	const voteName = (vote: Vote) =>
		({
			fail: say('Не працює', 'Broken'),
			weird: say('Дивно', 'Odd'),
			ok: say('Працює', 'Works')
		})[vote];

	async function copyReport() {
		const text = buildReport(betaMarks.marks, {
			lang: uk ? 'uk' : 'en',
			userAgent: navigator.userAgent,
			theme: theme.current,
			shell: isTauri() ? 'tauri' : 'browser',
			nowIso: new Date().toISOString()
		});

		/*
		 * Запасний шлях обовʼязковий (§ 6.2). `writeText` відмовляє буденно:
		 * вікно не у фокусі, сторінка не через https, немає дозволу. Без цього
		 * кнопка виглядала б натиснутою, а звіту не було б НІДЕ — тобто вся
		 * робота тестувальника зникала б на останньому кроці.
		 */
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			fallback = '';
		} catch {
			copied = false;
			fallback = text;
		}
	}

	/** Адреса застосунку — та сама сторінка без параметра чеклиста. */
	const appHref = window.location.pathname;
</script>

<div class="beta">
	<header class="beta__head">
		<h1>{say('Чеклист бета-тестування', 'Beta testing checklist')}</h1>
		<p class="beta__intro">
			{say(
				'Список того, чого не вміє перевірити машина. Позначки лишаються тільки у вашому браузері й нікуди не надсилаються. Наприкінці натисніть «Скопіювати звіт» і надішліть текст.',
				'A list of what no machine can check. Marks stay in your browser only and are sent nowhere. At the end press «Copy the report» and send the text.'
			)}
		</p>

		<p class="beta__meta">
			<span data-testid="beta-progress-value">
				{say('Зроблено', 'Done')}: {betaMarks.done}/{betaMarks.total}
			</span>

			<!--
				ВЕРСІЯ ЗБІРКИ ВИДИМА (§ 8.5.1, `BETA-VERSION-VISIBLE`): підказка
				«позначено на іншій версії» на пункті має сенс лише поряд із числом
				поточної збірки, інакше вона докір без інструкції.
			-->
			<span class="beta__version" data-testid="beta-version-text">{VERSION}</span>

			{#if betaMarks.staleCount > 0}
				<span class="beta__stale-total">
					{say('з інших збірок', 'from other builds')}: {betaMarks.staleCount}
				</span>
			{/if}

			<!--
				ВИХІД ЗІ СТОРІНКИ (§ 8.4): тестувальник приходить сюди за ПРЯМИМ
				посиланням, і повернутися в застосунок йому інакше нічим.
			-->
			<a class="beta__link" href={appHref} data-testid="beta-home-link">
				{say('До застосунку', 'To the app')}
			</a>
		</p>
	</header>

	<nav class="beta__tabs" aria-label={say('Розділи', 'Sections')}>
		<!--
			ЗВИЧАЙНІ КНОПКИ, А НЕ ARIA-ТАБИ (§ 8.2, `BETA-TABS-NOT-ARIA`).

			Роль `tab` — обіцянка цілого віджета: `role="tabpanel"` на вмісті,
			`aria-controls` на кожній вкладці й СТРІЛКИ ← → замість `Tab` для
			переходу між ними. Оголосити віджет, якого немає, гірше, ніж не
			оголошувати нічого: читалка назве його табами, людина натисне стрілку,
			а нічого не станеться.
		-->
		{#each BETA_TABS as item (item.id)}
			<button
				type="button"
				class="beta__tab"
				class:beta__tab--on={item.id === tab.id}
				aria-pressed={item.id === tab.id}
				onclick={() => (tab = item)}
				data-testid="beta-tab-{item.id}-btn"
			>
				{uk ? item.title.uk : item.title.en}
				<span class="beta__count" data-testid="beta-tab-{item.id}-progress-text">
					{betaMarks.doneIn(item)}/{item.checks.length}
				</span>
			</button>
		{/each}
	</nav>

	<!--
		ЕКРАНИ ВКЛАДКИ — ТЕКСТОМ, А НЕ ПОСИЛАННЯМИ (§ 8.4, відхилення за профілем).

		Канон просить показати перелік посиланнями, бо там вкладка називає адреси.
		Тут вона називає ЕКРАНИ — компоненти, які малює `App.svelte`, — і адреси в
		них немає: посилання вело б у нікуди. Назва екрана лишається тим самим
		переліком, який читає інваріант § 5.1, тож розійтися з дійсністю
		непоміченим він не може.
	-->
	<p class="beta__screens">
		<span class="beta__screens-label">{say('Де це дивитися:', 'Where to look:')}</span>
		{#each tab.screens as screen (screen)}
			<span class="beta__screen" data-testid="beta-screen-{tidOf(screen.toLowerCase())}-text">
				{screen}
			</span>
		{/each}
	</p>

	{#each LEVELS as level (level)}
		{@const checks = byLevel(tab, level)}
		{#if checks.length > 0}
			<section class="beta__level" data-testid="beta-level-{level}-section">
				<h2>{levelName(level)} · {checks.length}</h2>
				<p class="beta__level-hint">{levelHint(level)}</p>

				<ol class="beta__list" start={offsetOf(level) + 1}>
					{#each checks as check (check.id)}
						{@const tid = tidOf(check.id)}
						{@const mark = betaMarks.fresh(check.id)}
						<li
							class="beta__item"
							class:beta__item--marked={mark !== null}
							data-testid="beta-check-{tid}-item"
						>
							<p class="beta__category" data-testid="beta-check-{tid}-category-text">
								{uk ? check.category.uk : check.category.en}
								{#if check.negative}
									<span class="beta__flag">{say('межа', 'boundary')}</span>
								{/if}
							</p>

							<p class="beta__text" data-testid="beta-check-{tid}-text">
								{uk ? check.text.uk : check.text.en}
							</p>

							<!--
								Назва тесту під покритим пунктом (§ 8.7): коли тут щось
								ламається, видно, ЯКИЙ САМЕ тест збрехав, — не відкриваючи звіт.
							-->
							{#if check.test}
								<p class="beta__test">{check.test}</p>
							{/if}

							{#if betaMarks.stale(check.id)}
								<p class="beta__stale" data-testid="beta-check-{tid}-stale-hint">
									{say('позначено на версії', 'marked on version')}
									{betaMarks.marks[check.id].version}
								</p>
							{/if}

							<div class="beta__votes">
								{#each ['fail', 'weird', 'ok'] as const as vote (vote)}
									<button
										type="button"
										class="beta__vote beta__vote--{vote}"
										class:beta__vote--on={mark?.vote === vote}
										aria-pressed={mark?.vote === vote}
										onclick={() => betaMarks.vote(check.id, vote)}
										data-testid="beta-vote-{tid}-{vote}-btn"
									>
										{voteName(vote)}
									</button>
								{/each}
							</div>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/each}

	<section class="beta__report">
		<div class="beta__actions">
			<button type="button" class="beta__action" onclick={copyReport} data-testid="beta-report-btn">
				{say('Скопіювати звіт', 'Copy the report')}
			</button>

			<button
				type="button"
				class="beta__action beta__action--danger"
				class:beta__action--armed={betaMarks.clearArmed}
				onclick={() => betaMarks.requestClear()}
				data-testid="beta-clear-btn"
			>
				{betaMarks.clearArmed
					? say('Точно стерти? Ще раз', 'Really erase? Press again')
					: say('Стерти позначки', 'Erase marks')}
			</button>
		</div>

		<!--
			ДВІ ПІДКАЗКИ, А НЕ ОДНА (§ 6.2.1, `BETA-REPORT-HINT-SPLIT`).

			Спільний локатор зробив би сценарій «підказка видима» правдивим і на
			ВІДМОВІ буфера, і на успіху — тобто перевірка запасного шляху не
			перевіряла б запасного шляху.
		-->
		{#if copied}
			<p class="beta__hint" role="status" data-testid="beta-report-hint">
				{say('Звіт у буфері обміну.', 'The report is in the clipboard.')}
			</p>
		{/if}

		{#if fallback}
			<p class="beta__hint" role="alert" data-testid="beta-report-failed-hint">
				{say(
					'Буфер обміну відмовив — звіт нижче, скопіюйте його вручну.',
					'The clipboard refused: the report is below, copy it by hand.'
				)}
			</p>
			<textarea
				class="beta__fallback"
				readonly
				rows="14"
				aria-label={say('Звіт для копіювання', 'The report to copy')}
				data-testid="beta-report-input">{fallback}</textarea
			>
		{/if}
	</section>
</div>

<style>
	.beta {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		color: var(--text-primary);
	}

	h1 {
		margin: 0;
		font-size: clamp(1.3rem, 4vw, 1.9rem);
	}

	.beta__intro,
	.beta__level-hint,
	.beta__screens {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.beta__meta,
	.beta__screens {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin: 0.75rem 0 0;
	}

	.beta__version,
	.beta__stale-total,
	.beta__screen {
		padding: 0.05rem 0.4rem;
		border: 1px solid currentColor;
		border-radius: 4px;
		font-size: 0.78rem;
		opacity: 0.8;
	}

	/* 44 px на дотик: для тексту в рядку її дає `min-height` з `inline-flex`. */
	.beta__link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--accent-primary, currentColor);
	}

	.beta__tabs,
	.beta__votes,
	.beta__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.beta__tab,
	.beta__vote,
	.beta__action {
		min-height: 44px;
		padding: 0 0.9rem;
		border: 1px solid var(--border-color, currentColor);
		border-radius: 10px;
		background: var(--bg-secondary, transparent);
		color: inherit;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.beta__tab--on {
		border-width: 3px;
		font-weight: 700;
	}

	.beta__count {
		margin-left: 0.4rem;
		font-size: 0.78rem;
		opacity: 0.75;
	}

	.beta__level {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.beta__level h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.beta__list {
		margin: 0.5rem 0 0;
		padding-left: 1.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.beta__item {
		padding: 0.7rem;
		border: 1px solid var(--border-color, currentColor);
		border-left-width: 4px;
		border-radius: 10px;
	}

	/*
	 * Позначений пункт видно З ВІДСТАНІ (§ 8.7): повернувшись, людина шукає, де
	 * зупинилася, а не перечитує. І стан несе не лише колір — товщина рамки й
	 * `aria-pressed` кажуть те саме тому, хто кольорів не розрізняє (§ 3.2).
	 */
	.beta__item--marked {
		border-left-width: 10px;
	}

	.beta__category {
		margin: 0 0 0.25rem;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.75;
	}

	.beta__flag {
		margin-left: 0.4rem;
		padding: 0 0.35rem;
		border: 1px solid currentColor;
		border-radius: 4px;
		letter-spacing: 0;
		text-transform: none;
	}

	.beta__text {
		margin: 0;
		line-height: 1.55;
	}

	.beta__test,
	.beta__stale {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		opacity: 0.75;
	}

	.beta__test {
		font-family: monospace;
		word-break: break-all;
	}

	.beta__votes {
		margin-top: 0.5rem;
	}

	.beta__vote--on {
		border-width: 3px;
		font-weight: 700;
	}

	.beta__action--armed {
		border-width: 3px;
		font-weight: 700;
	}

	.beta__hint {
		margin: 0.6rem 0 0;
		font-size: 0.9rem;
	}

	.beta__fallback {
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.6rem;
		border: 1px solid var(--border-color, currentColor);
		border-radius: 10px;
		background: var(--bg-secondary, transparent);
		color: inherit;
		font-family: monospace;
		font-size: 0.82rem;
	}
</style>
