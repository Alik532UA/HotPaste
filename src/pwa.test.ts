import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * ДВА МЕХАНІЗМИ ОНОВЛЕННЯ, ЯКІ НЕ ЗНАЛИ ОДИН ПРО ОДНОГО.
 *
 * `registerType: 'autoUpdate'` означає, що новий воркер забирає ВЖЕ ВІДКРИТУ
 * вкладку під себе й прибирає з передкешу старі чанки — сторінка, яка тримає
 * їхні адреси, падає на першому ж лінивому імпорті. Рішення про це ухвалював
 * воркер, а не людина; у застосунку з відкритою текою це втрачений текст
 * сніпета.
 *
 * Паралельно з цим `UpdateModal` опитував `app-version.json` і показував
 * «доступна нова версія» — тобто про воркер не знав нічого, а воркер не знав
 * про нього.
 *
 * Перевірки нижче тримають ОДИН узгоджений шлях: воркер чекає, людина
 * натискає, і лише тоді сторінка перезавантажується.
 */

const VITE_CONFIG = readFileSync('vite.config.ts', 'utf8');
const RELOAD_PROMPT = readFileSync('src/lib/components/ui/ReloadPrompt.svelte', 'utf8');
const APP = readFileSync('src/App.svelte', 'utf8');
const DEPLOY = readFileSync('.github/workflows/deploy.yml', 'utf8');
const PKG = JSON.parse(readFileSync('package.json', 'utf8'));

describe('воркер чекає на людину', () => {
	it('registerType — prompt, а не autoUpdate', () => {
		expect(
			VITE_CONFIG,
			'autoUpdate забирає відкриту вкладку під новий воркер і робить ReloadPrompt ' +
				'мертвим кодом: needRefresh не стає true жодного разу'
		).toMatch(/registerType:\s*'prompt'/);
	});

	it('пропозиція оновитися існує і змонтована', () => {
		expect(RELOAD_PROMPT).toContain('useRegisterSW');
		expect(RELOAD_PROMPT).toContain('needRefresh');
		expect(
			APP,
			'ReloadPrompt не змонтований — воркер чекатиме вічно, і оновлення не ' +
				'застосується ніколи'
		).toContain('<ReloadPrompt />');
	});

	/**
	 * Питати доводиться самим: браузер перевіряє воркер лише на НАВІГАЦІЇ, а
	 * цей застосунок тримають відкритим годинами й не перезавантажують.
	 */
	it('перевірка оновлень не чекає на навігацію', () => {
		expect(RELOAD_PROMPT).toContain('visibilitychange');
		expect(RELOAD_PROMPT).toContain('setInterval');
	});
});

describe('у вікні застосунку воркера немає', () => {
	/**
	 * Service worker у Tauri шкідливий: він закешує вшиту в exe оболонку й
	 * віддаватиме її ПІСЛЯ того, як оновлювач поставить нову версію. Тобто
	 * застосунок оновився, а показує стару збірку — і полагодити це можна лише
	 * через DevTools, яких у людини немає.
	 */
	it('реєстрація умовна', () => {
		expect(
			RELOAD_PROMPT,
			'реєстрація воркера більше не залежить від середовища: у вікні застосунку ' +
				'він перехопить оболонку й переживе оновлення exe'
		).toMatch(/immediate:\s*!isTauri\(\)/);
	});

	it('вбудована реєстрація вимкнена — інакше умові немає де стояти', () => {
		expect(
			VITE_CONFIG,
			'injectRegister вмикає реєстрацію БЕЗУМОВНО, зокрема в Tauri'
		).toMatch(/injectRegister:\s*false/);
	});
});

describe('маніфест описує ту адресу, з якої віддається сторінка', () => {
	/**
	 * При `base: './'` зашитий `/HotPaste/` обіцяє одну адресу, а сторінка
	 * віддається з іншої: встановлений застосунок відкривається на чужому
	 * шляху. У Tauri, де схема взагалі не http, такий `start_url` не має сенсу.
	 */
	it('адреси відносні', () => {
		expect(VITE_CONFIG).toMatch(/base:\s*'\.\/'/);
		expect(
			VITE_CONFIG,
			'у маніфесті лишилася зашита адреса GitHub Pages при відносному base'
		).not.toMatch(/start_url:\s*"\/HotPaste\/"/);
	});
});

describe('гейт над збіркою запускається', () => {
	it('скрипт існує', () => {
		expect(PKG.scripts['check:build']).toBe('node scripts/check-build.mjs');
	});

	/**
	 * Гейт, який ніхто не запускає, — це не гейт. Тут він єдиний, хто бачить
	 * згенерований воркер і маніфест: у `src/` їх немає взагалі.
	 */
	it('його кличе CI', () => {
		expect(
			DEPLOY,
			'check:build не викликається в деплої — тобто безумовний skipWaiting ' +
				'у збірці нікому не показався б'
		).toContain('npm run check:build');
	});
});
