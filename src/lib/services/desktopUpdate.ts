import { logService } from './logService.svelte';
import { isTauri } from '../utils/runtime';

/**
 * ОНОВЛЕННЯ ВСТАНОВЛЕНОГО ЗАСТОСУНКУ.
 *
 * ## Чого тут не було
 *
 * Каналу доставки не існувало ЖОДНОГО. Фронтенд лежить усередині exe, а
 * `deploy.yml` публікує тільки веб-версію — тобто правка інтерфейсу доїжджала
 * до людини рівно тоді, коли вона сама здогадалася перевстановити застосунок.
 *
 * Гірше: `versionService.applyUpdateAndDeepClean()` виглядав як оновлення й
 * ним не був. У вікні застосунку він кликав `relaunch()` — тобто перезапускав
 * ТУ САМУ версію, попередньо стерши локальні налаштування. Єдиний випадок,
 * коли він щось міняв, — коли людина вже перевстановила exe руками.
 *
 * ## Три різні стани, а не два
 *
 * Тут навмисно розрізняється «оновлення немає» і «перевірити не вдалося».
 * Друге — нормальний стан для збірки з дерева розробника: налаштування
 * оновлення (адреси й відкритий ключ) лежать у `tauri.conf.release.json`, який
 * накладається лише в релізній збірці. Плутати ці два стани не можна: «не
 * вдалося» мусить вести до запасного шляху, а не до «у вас найновіша версія».
 *
 * Запасний шлях — старий `versionService`: він читає `app-version.json` і
 * ЛИШЕ повідомляє, що вийшла нова версія. Це чесна межа: сказати можемо
 * завжди, поставити — лише там, де є підписаний канал.
 */

export type DesktopUpdate =
	| { kind: 'none' }
	| { kind: 'unavailable'; reason: string }
	| { kind: 'ready'; version: string; install: () => Promise<void> };

/**
 * Чи є оновлення для встановленого застосунку.
 *
 * У браузері одразу `unavailable`: там оновлення — це service worker, і робить
 * його зовсім інший шлях.
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdate> {
	if (!isTauri()) {
		return { kind: 'unavailable', reason: 'не застосунок' };
	}

	try {
		const { check } = await import('@tauri-apps/plugin-updater');
		const update = await check();

		if (!update) {
			return { kind: 'none' };
		}

		return {
			kind: 'ready',
			version: update.version,
			install: async () => {
				logService.info('Update', `Downloading ${update.version}…`);
				await update.downloadAndInstall();
				/*
				 * Після встановлення потрібен перезапуск, і робить його
				 * `relaunch()` із плагіна процесів — той самий, який доти
				 * викликали ЗАМІСТЬ оновлення.
				 *
				 * У Windows `installMode: "passive"` показує смужку прогресу
				 * інсталятора й закриває застосунок сам, тож цей рядок
                 * виконується не завжди — і саме тому він тут останній.
				 */
				const { relaunch } = await import('@tauri-apps/plugin-process');
				await relaunch();
			}
		};
	} catch (error) {
		/*
		 * Сюди потрапляє і «немає мережі», і «канал не налаштований у цій
		 * збірці». Розрізняти їх тут нема з чого — плагін віддає рядок, — та й
		 * не треба: наслідок однаковий, і він не «все гаразд».
		 */
		const reason = error instanceof Error ? error.message : String(error);
		logService.warn('Update', `Updater unavailable: ${reason}`);
		return { kind: 'unavailable', reason };
	}
}
