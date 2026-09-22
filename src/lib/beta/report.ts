import { BETA_TABS } from './checks';
import { VERSION, type Marks, type Vote } from './marks.svelte';

/**
 * Звіт, який людина копіює й надсилає (§ 6).
 *
 * ТЕКСТ У БУФЕР, А НЕ ЗАПИС У БАЗУ (§ 6.1, `BETA-REPORT-LOCAL`). Збирати на
 * сервер означає таблицю, правила доступу до неї й чужі імена в ній — заради
 * даних, яких поки ніхто не читає. Рішення дешево скасувати: агрегація
 * доклеюється пізніше, не переписуючи сторінку.
 *
 * У звіті: версія збірки, час в ISO, `userAgent`, мова, тема, оболонка — і
 * ЛИШЕ позначені пункти. Перелік недивленого зробив би звіт нечитним: людина
 * шле те, що перевірила, а не те, до чого не дійшла.
 */

export interface ReportContext {
	/** Мова, якою зараз читають чеклист. */
	lang: 'uk' | 'en';
	userAgent: string;
	/** Тема застосунку: половина пунктів про кольори, і без неї їх не розібрати. */
	theme: string;
	/** Оболонка: вікно застосунку чи браузер — від цього залежить частина пунктів. */
	shell: 'tauri' | 'browser';
	nowIso: string;
}

const ORDER: Record<Vote, number> = { fail: 0, weird: 1, ok: 2 };

export function buildReport(marks: Marks, ctx: ReportContext): string {
	const uk = ctx.lang === 'uk';

	const label: Record<Vote, string> = {
		fail: uk ? 'НЕ ПРАЦЮЄ' : 'BROKEN',
		weird: uk ? 'ПРАЦЮЄ, АЛЕ ДИВНО' : 'WORKS, BUT ODD',
		ok: uk ? 'ПРАЦЮЄ' : 'WORKS'
	};

	const staleNote = uk ? 'позначено на версії' : 'marked on version';

	/*
	 * Помилка в ПОКРИТОМУ пункті — окремим рядком, і це найважливіше в усьому
	 * звіті (§ 3). Вона означає дефект ТЕСТА, а не застосунку: новина гірша за
	 * звичайний баг, бо знецінює всі зелені прогони. Загубитися серед решти
	 * рядків вона не має права.
	 */
	const coveredWarning = uk
		? 'ПУНКТ ПОКРИТО АВТОТЕСТОМ — тест не побачив цієї помилки:'
		: 'THIS ITEM IS COVERED BY A TEST — the test missed this:';

	const lines: string[] = [
		`HotPaste ${VERSION}`,
		ctx.nowIso,
		`${uk ? 'оболонка' : 'shell'}: ${ctx.shell}`,
		`${uk ? 'тема' : 'theme'}: ${ctx.theme}`,
		`${uk ? 'мова' : 'language'}: ${ctx.lang}`,
		ctx.userAgent,
		''
	];

	const marked = BETA_TABS.flatMap((tab) =>
		tab.checks.filter((check) => marks[check.id]).map((check) => ({ tab, check }))
	).sort((a, b) => ORDER[marks[a.check.id].vote] - ORDER[marks[b.check.id].vote]);

	if (marked.length === 0) {
		lines.push(uk ? 'Жодного пункта ще не позначено.' : 'Nothing has been marked yet.');
		return lines.join('\n');
	}

	for (const { tab, check } of marked) {
		const mark = marks[check.id];
		lines.push(`[${label[mark.vote]}] ${check.id} (${uk ? tab.title.uk : tab.title.en})`);
		lines.push(`    ${uk ? check.text.uk : check.text.en}`);

		if (mark.version !== VERSION) lines.push(`    (${staleNote} ${mark.version})`);

		if (mark.vote !== 'ok' && check.coverage === 'covered') {
			lines.push(`    !!! ${coveredWarning} ${check.test}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}
