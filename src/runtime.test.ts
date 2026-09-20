import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ОДНА ПЕРЕВІРКА СЕРЕДОВИЩА, А НЕ ДЕСЯТЬ КОПІЙ.
 *
 * ## Що було
 *
 * Вираз «ми у вікні застосунку» був переписаний від руки в ДЕСЯТИ місцях, і
 * вже в трьох різних формах: `!!(a || b)`, `(!!a || !!b)`,
 * `typeof window !== 'undefined' && (a || b)`. Копії, переписані від руки,
 * розходяться — і розійшлися: `index.html` перевіряв ЛИШЕ `window.__TAURI__`,
 * решта дивилася ще й на `__TAURI_INTERNALS__`.
 *
 * ## Чому це перестало бути косметикою
 *
 * `window.__TAURI__` існує лише при `withGlobalTauri`, а прапорець прибрано:
 * він віддає сторінці весь API Tauri одним глобальним об'єктом, доступним
 * будь-якому сторонньому скрипту без імпорту. Отже та сама копія в
 * `index.html` після цього стала б ЗАВЖДИ хибною — клас `is-tauri` не
 * ставився б ніколи, а виглядало б це як «застосунок відкрився зі стилями
 * браузерної версії».
 *
 * Тобто дефект від розходження копій уже стояв у черзі; лишалося увімкнути
 * прапорець безпеки, щоб він вистрілив.
 *
 * ## Чому перевірка по джерелах
 *
 * Дефект — у НАЯВНОСТІ виразу там, де його бути не має. Тест поведінки
 * довелося б писати на кожне місце окремо, і одинадцяте, дописане завтра, він
 * не побачив би.
 *
 * Коментарі знімаються перед пошуком: інакше перевірка ловить власні
 * пояснення, а файл із порушенням проходить через згадку назви поруч.
 */

const ROOTS = ['src'];

/** Єдиний модуль, якому дозволено знати, як виглядає ознака середовища. */
const RUNTIME_MODULE = 'src/lib/utils/runtime.ts';

/**
 * Інлайн у голові документа. Йому дозволено мати власну копію: це чистий HTML
 * до будь-якого модуля, а клас мусить стояти ДО першого кадру. Але копія там
 * рівно одна, і перевіряється вона окремо.
 */
const SHELL_HTML = 'index.html';

function sources(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry).replace(/\\/g, '/');
		if (statSync(full).isDirectory()) sources(full, out);
		else if (/\.(ts|svelte)$/.test(entry) && !/\.(test|spec)\.ts$/.test(entry)) out.push(full);
	}
	return out;
}

function withoutComments(code: string): string {
	return code
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n');
}

const files = ROOTS.flatMap((r) => sources(r)).map((path) => ({
	path,
	code: withoutComments(readFileSync(path, 'utf8'))
}));

const shell = withoutComments(readFileSync(SHELL_HTML, 'utf8'));

describe('перевірка жива', () => {
	it('джерела знайдено', () => {
		expect(files.length, 'сканер не знайшов джерел — порівнювати нема з чим').toBeGreaterThan(20);
	});

	it('модуль середовища існує й експортує isTauri', () => {
		const runtime = files.find((f) => f.path === RUNTIME_MODULE);
		expect(runtime, `${RUNTIME_MODULE} зник — перевірки нижче стали б порожніми`).toBeDefined();
		expect(runtime?.code).toMatch(/export function isTauri/);
	});

	it('ним справді користуються', () => {
		const users = files.filter(
			(f) => f.path !== RUNTIME_MODULE && /isTauriRuntime\s*\(|isTauri\s*\(\)/.test(f.code)
		);
		expect(
			users.length,
			'ніхто не кличе isTauri() — або перевірку середовища прибрали, або її знову пишуть на місці'
		).toBeGreaterThan(5);
	});
});

describe('ознака середовища названа в одному місці', () => {
	it('__TAURI_INTERNALS__ не згадується в застосунку поза модулем середовища', () => {
		const offenders = files
			.filter((f) => f.path !== RUNTIME_MODULE)
			.filter((f) => /__TAURI_INTERNALS__/.test(f.code))
			.map((f) => f.path);
		expect(
			offenders,
			'перевірку середовища переписали на місці. Її форма вже розходилася в ' +
				`десяти копіях — кличте isTauri() з ${RUNTIME_MODULE}:\n${offenders.join('\n')}`
		).toEqual([]);
	});

	/**
	 * `__TAURI__` окремим правилом і з іншою причиною: він не просто дублює
	 * ознаку, він означає УВІМКНЕНИЙ `withGlobalTauri`. Поки прапорець
	 * вимкнений, будь-яка перевірка на нього хибна завжди — тобто це не копія,
	 * а мертвий код, який виглядає робочим.
	 */
	it('__TAURI__ згадується лише в модулі середовища', () => {
		const offenders = files
			.filter((f) => f.path !== RUNTIME_MODULE)
			.filter((f) => /__TAURI__/.test(f.code))
			.map((f) => f.path);
		expect(
			offenders,
			'`window.__TAURI__` існує лише при withGlobalTauri, а прапорець вимкнений: ' +
				`така перевірка хибна ЗАВЖДИ:\n${offenders.join('\n')}`
		).toEqual([]);
	});
});

describe('оболонка документа', () => {
	it('ставить is-tauri за ознакою, яка існує без withGlobalTauri', () => {
		expect(
			shell,
			'index.html перевіряє __TAURI__ — при вимкненому withGlobalTauri це ніколи не ' +
				'спрацює, і вікно застосунку отримає стилі браузерної версії'
		).not.toMatch(/window\.__TAURI__\b/);
		expect(shell).toMatch(/window\.__TAURI_INTERNALS__/);
	});
});

describe('можливості вікна', () => {
	const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'));
	const permissions: unknown[] = capability.permissions ?? [];
	const asText = JSON.stringify(permissions);

	/**
	 * Ці три дозволи прибрані, і кожен повертався б непомітно: у можливостях
	 * немає нічого, що впало б від зайвого рядка, — навпаки, зайвий рядок
	 * лагодить будь-яку відмову. Саме так широкі дозволи й накопичуються.
	 */
	it('оболонці не дозволено запускати команди', () => {
		expect(
			asText,
			'shell:allow-execute повернувся: це «запустити довільну програму з вебв\'ю». ' +
				'Показ теки робить команда reveal_in_project, і межу перевіряє файлова система'
		).not.toContain('shell:allow-execute');
	});

	it('відкривання посилань — типовою областю, без власних регулярок', () => {
		expect(
			asText,
			'shell:allow-open зі своєю областю повернувся. Типовий shell:default дозволяє ' +
				'рівно http(s), mailto і tel — саме те, що застосунок відкриває'
		).not.toContain('shell:allow-open');
		expect(permissions).toContain('shell:default');
	});

	it('файлова область не виходить за теку проєкту', () => {
		const scope = permissions.find(
			(p): p is { identifier: string; allow: { path: string }[] } =>
				typeof p === 'object' && p !== null && (p as { identifier?: string }).identifier === 'fs:scope'
		);
		expect(scope, 'fs:scope зник — область файлів стала типовою, тобто ширшою').toBeDefined();
		const outside = (scope?.allow ?? [])
			.map((entry) => entry.path)
			.filter((path) => !path.startsWith('$DOCUMENT/HotPaste'));
		expect(outside, `шлях поза текою проєкту:\n${outside.join('\n')}`).toEqual([]);
	});
});

describe('конфіг вікна', () => {
	const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));

	it('глобальний API Tauri не віддається сторінці', () => {
		expect(
			conf.app?.withGlobalTauri,
			'withGlobalTauri повернувся: він кладе весь API Tauri у window одним об\'єктом, ' +
				'тобто віддає його будь-якому сторонньому скрипту без імпорту. Модулі ' +
				'@tauri-apps/api працюють і без нього'
		).toBeFalsy();
	});
});
