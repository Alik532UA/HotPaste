import { versionStore } from "../stores/versionStore.svelte";
import { storage } from "./storage";
import { logService } from "./logService.svelte";
import { isTauri as isTauriRuntime } from '../utils/runtime';
import { checkDesktopUpdate } from "./desktopUpdate";

const VERSION_URL = "./app-version.json";
const LOCAL_V_KEY = "hp_version_current";
const REFUSED_V_KEY = "hp_version_refused";
const REFUSED_AT_KEY = "hp_version_refused_at";
const COOLDOWN = 5 * 24 * 60 * 60 * 1000; // 5 днів

/** Куди вести, коли сказати про версію можемо, а поставити її — ні. */
const RELEASES_URL = "https://github.com/Alik532UA/HotPaste/releases/latest";

/** Порівняння версій (повертає true, якщо v1 > v2) */
function isNewer(v1: string, v2: string): boolean {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (p1[i] > p2[i]) return true;
        if (p1[i] < p2[i]) return false;
    }
    return false;
}

/**
 * Перевірка оновлень. Викликається при старті застосунку.
 *
 * ПОРЯДОК ВАЖЛИВИЙ. Спершу питаємо підписаний канал (`desktopUpdate`): лише
 * він уміє ПОСТАВИТИ нову версію. Якщо каналу в цій збірці немає або він не
 * відповів — переходимо на читання `app-version.json`, яке вміє тільки
 * сказати, що версія вийшла.
 *
 * Плутати «оновлення немає» з «перевірити не вдалося» не можна: перше
 * закінчує роботу, друге мусить вести до запасного шляху. Доти цієї різниці не
 * існувало, бо не існувало й першого шляху.
 */
export async function checkForUpdates() {
    const desktop = await checkDesktopUpdate();

    if (desktop.kind === 'ready') {
        versionStore.setVersion(desktop.version);
        versionStore.setInstaller(desktop.install);
        versionStore.setUpdate(true);
        return;
    }

    // Канал відповів «немає» — це відповідь, і запасний шлях тут зайвий.
    if (desktop.kind === 'none') {
        versionStore.setInstaller(null);
        return;
    }

    versionStore.setInstaller(null);
    await checkVersionFile();
}

/** Запасний шлях: читання `app-version.json`. Уміє лише повідомити. */
async function checkVersionFile() {
    try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" });
        const { version: serverV } = await res.json();
        
        // Отримуємо версію, яка зараз реально запущена
        const currentRunningV = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
        
        // Отримуємо версію, яку ми вважаємо "поточною" в цьому браузері
        let localV = storage.get(LOCAL_V_KEY);

        // Якщо це перший запуск (немає запису), просто фіксуємо поточну версію як встановлену
        if (!localV) {
            storage.set(LOCAL_V_KEY, currentRunningV);
            return;
        }

        // Якщо версія на сервері новіша за ту, що збережена в браузері
        if (isNewer(serverV, localV)) {
            const refusedV = storage.get(REFUSED_V_KEY);
            const refusedAt = parseInt(storage.get(REFUSED_AT_KEY) || "0");
            const now = Date.now();

            // Пропонуємо оновлення, якщо:
            // 1. Раніше не відмовлялися від ЦІЄЇ конкретної версії (або будь-якої)
            // 2. АБО вийшла версія НОВІША за ту, від якої відмовилися
            // 3. АБО минуло більше 5 днів
            const isDifferentFromServer = !refusedV || isNewer(serverV, refusedV);
            
            if (isDifferentFromServer || (now - refusedAt > COOLDOWN)) {
                versionStore.setVersion(serverV);
                versionStore.setUpdate(true);
            }
        }
    } catch (e) { logService.error('Version', `Update check failed: ${e}`); }
}

/**
 * Застосувати оновлення.
 *
 * ## Що тут було зламане, і це не одна річ
 *
 * 1. У ЗАСТОСУНКУ функція кликала `relaunch()`. Фронтенд лежить усередині exe,
 *    тож перезапуск давав ТУ САМУ версію. Людина натискала «Оновити»,
 *    застосунок перезапускався, версія не мінялася. Єдиний випадок, коли
 *    щось змінювалося, — коли exe вже перевстановили руками.
 *
 * 2. `storage.clear()` СТИРАВ УСІ ЛОКАЛЬНІ ДАНІ застосунку: тему, гарячі
 *    клавіші, призначення клавіш меню, обрану теку. Це робилося на кожному
 *    оновленні, і у вікні з написом «Ваші підключені папки та файли не
 *    постраждають» — що правда лише буквально: самі файли цілі, а все, що
 *    людина налаштувала, зникало.
 *
 * Тепер стирається рівно те, заради чого функцію писали: кеш оболонки. Він
 * справді може суперечити новій збірці. Налаштування — ні.
 *
 * ## Чому фільтр кешів двома ознаками
 *
 * `k.includes('hotpaste')` не збігався з жодним справжнім іменем: кеші тут
 * називає воркер, і зве він їх `workbox-precache-v2-https://…/HotPaste/` —
 * з великими літерами, а порівняння чутливе до регістру. Тобто «глибоке
 * очищення» не чистило нічого. Ознака нашого кеша — власний `scope` усередині
 * імені; префікс лишається для кешів, які застосунок назве сам.
 */
export async function applyUpdateAndDeepClean() {
    try {
        // Підписаний канал уміє поставити нову версію — це інша дія, і все
        // нижче до неї не стосується.
        const install = versionStore.installer;
        if (install) {
            await install();
            return;
        }

        if ("caches" in window) {
            const scope = new URL('./', window.location.href).href;
            const keys = await caches.keys();
            const ourKeys = keys.filter(
                (k) => k.startsWith('hotpaste-') || k.includes(scope)
            );
            await Promise.all(ourKeys.map(k => caches.delete(k)));
        }

        // Реєстрація воркера — лише СВОЯ. `getRegistration()` без аргументів
        // віддає ту, що керує цією сторінкою; `getRegistrations()` віддав би
        // реєстрації всього origin, тобто сусідніх проєктів на GitHub Pages.
        if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            await registration?.unregister();
        }

        storage.set(LOCAL_V_KEY, versionStore.serverVersion);

        if (isTauriRuntime()) {
            /*
             * Сюди потрапляє збірка застосунку БЕЗ підписаного каналу — тобто
             * зібрана з дерева розробника. Перезапуск тут нічого не оновить,
             * тому й не робиться: чесніше відкрити сторінку завантаження.
             */
            const { open } = await import('@tauri-apps/plugin-shell');
            await open(RELEASES_URL);
            versionStore.setUpdate(false);
            return;
        }

        window.location.reload();
    } catch (e) {
        logService.error('VersionService', `Update failed: ${e}`);
        versionStore.setManualRestart(true);
    }
}

/** Відкласти оновлення (Slovko logic) */
export function skipUpdate() {
    storage.set(REFUSED_V_KEY, versionStore.serverVersion);
    storage.set(REFUSED_AT_KEY, Date.now().toString());
    versionStore.setUpdate(false);
}