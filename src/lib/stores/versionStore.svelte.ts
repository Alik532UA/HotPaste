// src/lib/stores/versionStore.svelte.ts
let serverVersion = $state("0.0.0");
let isUpdateAvailable = $state(false);
let needsManualRestart = $state(false);

/**
 * Дія, яка справді ВСТАНОВИТЬ оновлення, — або `null`, якщо такої немає.
 *
 * Це не деталь реалізації, а те, що мусить бачити інтерфейс. Доти кнопка
 * «Оновити» була одна на всі випадки, і в застосунку вона кликала
 * `relaunch()` — тобто перезапускала ту саму версію. Людина натискала
 * оновлення, застосунок перезапускався, версія лишалася стара, і пояснити це
 * не було чим.
 *
 * Тепер «знаємо про нову версію» і «вміємо її поставити» — різні факти, і
 * кнопка підписується за другим.
 */
let installer = $state<null | (() => Promise<void>)>(null);

export const versionStore = {
    get serverVersion() { return serverVersion; },
    get isUpdateAvailable() { return isUpdateAvailable; },
    get needsManualRestart() { return needsManualRestart; },
    get installer() { return installer; },

    setVersion(v: string) { serverVersion = v; },
    setUpdate(status: boolean) { isUpdateAvailable = status; },
    setManualRestart(status: boolean) { needsManualRestart = status; },
    setInstaller(fn: null | (() => Promise<void>)) { installer = fn; }
};
