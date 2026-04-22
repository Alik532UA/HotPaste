import { versionStore } from "../stores/versionStore.svelte";
import { storage } from "./storage";
import { sessionStore } from "./sessionStore";
import { relaunch } from "@tauri-apps/plugin-process"; // Tauri V2 API
import { logService } from "./logService.svelte";

const VERSION_URL = "./app-version.json";
const LOCAL_V_KEY = "hp_version_current";
const REFUSED_V_KEY = "hp_version_refused";
const REFUSED_AT_KEY = "hp_version_refused_at";
const COOLDOWN = 5 * 24 * 60 * 60 * 1000; // 5 днів

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

/** Перевірка наявності оновлень (викликається при старті App) */
export async function checkForUpdates() {
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

/** Процес глибокого очищення та перезапуску */
export async function applyUpdateAndDeepClean() {
    try {
        // 1. Очищення браузерного кешу (Service Workers + Cache API) - тільки для цього додатку
        if ("caches" in window) {
            const keys = await caches.keys();
            const ourKeys = keys.filter(k => k.includes('hotpaste'));
            await Promise.all(ourKeys.map(k => caches.delete(k)));
        }

        // 2. Очищення Web Storage (localStorage, sessionStorage, IndexedDB)
        storage.clear();
        sessionStore.clear();

        // 3. Записуємо нову версію ПІСЛЯ очищення
        storage.set(LOCAL_V_KEY, versionStore.serverVersion);

        // 4. Перезапуск
        // @ts-ignore
        const isTauri = !!(typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__));

        if (isTauri) {
            await relaunch();
        } else {
            // У браузері просто оновлюємо сторінку
            window.location.reload();
        }
    } catch (e) {
        logService.error('VersionService', `Relaunch failed: ${e}`);
        // Fallback: якщо щось пішло не так (наприклад, у браузері reload заблоковано)
        versionStore.setManualRestart(true);
    }
}

/** Відкласти оновлення (Slovko logic) */
export function skipUpdate() {
    storage.set(REFUSED_V_KEY, versionStore.serverVersion);
    storage.set(REFUSED_AT_KEY, Date.now().toString());
    versionStore.setUpdate(false);
}