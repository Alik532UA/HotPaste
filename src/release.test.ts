import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

/**
 * КАНАЛ ОНОВЛЕННЯ — ланцюг із чотирьох ланок, і кожна рветься тихо.
 *
 * Оновлення встановленого застосунку працює лише тоді, коли зійшлося все:
 *
 *   1. плагін зареєстрований у Rust;
 *   2. дозвіл `updater:default` є у можливостях вікна — інакше виклик із
 *      вебвʼю відкидає ACL;
 *   3. у релізній збірці є адреса `latest.json` і ВІДКРИТИЙ ключ;
 *   4. релізний workflow справді кладе `latest.json` у реліз.
 *
 * Жодна з цих ланок при поломці нічого не ламає ВИДИМО. Застосунок
 * запускається, працює, просто ніколи не оновлюється — і дізнатися про це
 * можна лише через місяці, коли хтось помітить, що на машинах стара версія.
 * Саме тому це перевірка по файлах: поведінкою її не відтвориш без живого
 * релізу.
 *
 * Перевірити НЕ можна одного — що відкритий ключ відповідає приватному з
 * секретів. Це видно лише на машині, яка приймає оновлення.
 */

const CONF = 'src-tauri/tauri.conf.json';
const RELEASE_CONF = 'src-tauri/tauri.conf.release.json';
const CAPABILITY = 'src-tauri/capabilities/default.json';
const WORKFLOW = '.github/workflows/release.yml';
const LIB_RS = 'src-tauri/src/lib.rs';

const conf = JSON.parse(readFileSync(CONF, 'utf8'));
const releaseConf = JSON.parse(readFileSync(RELEASE_CONF, 'utf8'));
const capability = JSON.parse(readFileSync(CAPABILITY, 'utf8'));
const workflow = readFileSync(WORKFLOW, 'utf8');
const libRs = readFileSync(LIB_RS, 'utf8');

describe('плагін оновлення підʼєднаний', () => {
	it('зареєстрований у Rust', () => {
		expect(
			libRs,
			'tauri_plugin_updater не зареєстрований — команди оновлення не існує, ' +
				'і виклик із вебв\'ю падає з «unknown command»'
		).toContain('tauri_plugin_updater::Builder::new()');
	});

	it('дозволений у можливостях вікна', () => {
		expect(
			capability.permissions,
			'без updater:default виклик check() відкидає ACL, а помилка читається ' +
				'як «оновлень немає»'
		).toContain('updater:default');
	});
});

describe('релізна збірка знає, звідки брати оновлення', () => {
	it('накладка існує окремо від основного конфігу', () => {
		expect(existsSync(RELEASE_CONF)).toBe(true);
		/*
		 * Налаштування оновлення НЕ в основному конфігу навмисно: разом із
		 * `createUpdaterArtifacts` вони вимагають ключ підпису на кожній
		 * збірці, тобто локальна збірка перестала б працювати без секрету.
		 */
		expect(
			conf.plugins?.updater,
			'налаштування оновлення переїхали в основний конфіг — тоді локальна ' +
				'збірка вимагатиме ключа підпису'
		).toBeUndefined();
	});

	it('адреса latest.json указана', () => {
		const endpoints: string[] = releaseConf.plugins?.updater?.endpoints ?? [];
		expect(endpoints.length, 'без endpoints застосунок не має куди питати').toBeGreaterThan(0);
		expect(endpoints.some((e) => e.endsWith('latest.json'))).toBe(true);
	});

	it('оновлювані артефакти вмикаються саме тут', () => {
		expect(releaseConf.bundle?.createUpdaterArtifacts).toBe(true);
	});

	/**
	 * Заглушка ключа — єдине місце, де перевірка навмисно ЗЕЛЕНА при
	 * незавершеному налаштуванні.
	 *
	 * Червоний тест тут означав би «проєкт зламаний» на кожній машині, де ще
	 * не згенерували пару, — тобто гейт, який червоніє не від дефекту. Те саме
	 * питання ставить крок у самому workflow, і там воно доречне: він
	 * виконується рівно при випуску, коли ключ уже мусить бути.
	 */
	it('workflow відмовляється випускати з заглушкою замість ключа', () => {
		expect(
			workflow,
			'крок перевірки ключа зник: реліз зібрався б і опублікувався, а ' +
				'застосунок не прийняв би жодного оновлення'
		).toContain('ЗАМІНІТЬ_ЦЕ_НА_ВІДКРИТИЙ_КЛЮЧ');
	});
});

describe('релізний workflow', () => {
	it('запускається за тегом', () => {
		expect(workflow).toMatch(/tags:\s*\n\s*-\s*'v\*'/);
	});

	it('передає приватний ключ і пароль у збірку', () => {
		expect(workflow).toContain('TAURI_SIGNING_PRIVATE_KEY');
		expect(workflow).toContain('TAURI_SIGNING_PRIVATE_KEY_PASSWORD');
	});

	it('кладе latest.json у реліз', () => {
		expect(
			workflow,
			'без includeUpdaterJson реліз виглядає повним, а оновлення не приходить нікому'
		).toContain('includeUpdaterJson: true');
	});

	it('збирає накладкою, а не основним конфігом', () => {
		expect(workflow).toContain('--config src-tauri/tauri.conf.release.json');
	});

	/**
	 * `default-run = "HotPaste-dev"`: типовий бінарник у цьому проєкті —
	 * DEV-збірка. Реліз без явного `--bin` спакував би саме її, і помітити це
	 * можна було б хіба за назвою вікна.
	 */
	it('пакує бойовий бінарник, а не dev', () => {
		expect(workflow).toContain('--bin HotPaste');
	});

	it('проганяє гейти перед публікацією', () => {
		expect(workflow).toContain('npm run check');
		expect(workflow).toContain('npm test');
	});
});
