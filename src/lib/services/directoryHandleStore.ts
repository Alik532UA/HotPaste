import { logService } from './logService.svelte';

/**
 * ТЕКА, ОБРАНА ОДНОГО РАЗУ, ПЕРЕЖИВАЄ ПЕРЕЗАВАНТАЖЕННЯ.
 *
 * ## Чого тут не було
 *
 * У браузерній версії дескриптор теки жив ЛИШЕ в пам'яті сторінки
 * (`private rootHandle` у `LocalFileSystemService`). Будь-яке
 * перезавантаження — і обирати теку доводилося заново, через системний діалог.
 * Тобто встановлений як застосунок HotPaste зустрічав людину порожнім екраном
 * щоразу, і жодна кількість зробленого поруч цього не рятувала.
 *
 * ## Чому IndexedDB, а не localStorage
 *
 * `FileSystemDirectoryHandle` — не рядок і не JSON. Це об'єкт, який браузер
 * уміє зберігати лише структурованим клонуванням, а `localStorage` зберігає
 * рядки. `JSON.stringify` дескриптора дає `{}` — тобто спроба покласти його в
 * `localStorage` не падає, вона мовчки зберігає порожнечу.
 *
 * ## Чому дозволу цього замало
 *
 * Відновлений дескриптор НЕ означає відновленого доступу. Браузер питає
 * дозволу окремо, і `requestPermission()` вимагає ЖЕСТУ людини — виклик із
 * `onMount` відхиляється завжди. Тому відновлення тут двоетапне:
 * `queryPermission()` мовчки при старті, і лише якщо він каже `prompt` —
 * кнопка, яку натискає людина (див. `restoreAccessWithGesture`).
 *
 * Плутати ці стани не можна: «дозвіл є» і «дескриптор є, дозволу поки немає» —
 * різні екрани.
 */

const DB_NAME = 'hotpaste';
const DB_VERSION = 1;
const STORE = 'handles';
const KEY = 'root-directory';

function openDatabase(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null);

	return new Promise((resolve) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};

		/*
		 * Відмова тут — НЕ поломка застосунку: у приватному режимі частини
		 * браузерів IndexedDB недоступна зовсім. Наслідок рівно той, що був
		 * доти: теку доведеться обрати заново.
		 */
		request.onerror = () => {
			logService.warn('FileSystem', `IndexedDB unavailable: ${request.error?.message}`);
			resolve(null);
		};
		request.onsuccess = () => resolve(request.result);
		request.onblocked = () => resolve(null);
	});
}

function transact<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
	return openDatabase().then(
		(db) =>
			new Promise<T | null>((resolve) => {
				if (!db) return resolve(null);
				try {
					const request = run(db.transaction(STORE, mode).objectStore(STORE));
					request.onsuccess = () => resolve(request.result ?? null);
					request.onerror = () => resolve(null);
				} catch (error) {
					logService.warn('FileSystem', `IndexedDB access failed: ${error}`);
					resolve(null);
				}
			})
	);
}

/** Запам'ятати обрану теку. Мовчазна відмова означає «доведеться обрати ще раз». */
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
	await transact('readwrite', (store) => store.put(handle, KEY));
}

/** Дескриптор із минулого сеансу, або `null`. */
export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
	const handle = await transact<FileSystemDirectoryHandle>('readonly', (store) =>
		store.get(KEY)
	);
	return handle ?? null;
}

/**
 * Забути теку.
 *
 * Потрібно не лише для «від'єднатися»: дескриптор стає непридатним, коли теку
 * перейменували або видалили, і тримати його далі означало б показувати кнопку
 * відновлення, яка ніколи не спрацює.
 */
export async function clearDirectoryHandle(): Promise<void> {
	await transact('readwrite', (store) => store.delete(KEY));
}
