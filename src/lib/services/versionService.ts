import { versionStore } from "../stores/versionStore.svelte";
import { relaunch } from "@tauri-apps/plugin-process"; // Tauri V2 API

const VERSION_URL = "/app-version.json";
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
        const localV = localStorage.getItem(LOCAL_V_KEY) || "0.0.0";

        if (localV !== serverV) {
            const refusedV = localStorage.getItem(REFUSED_V_KEY);
            const refusedAt = parseInt(localStorage.getItem(REFUSED_AT_KEY) || "0");
            const now = Date.now();

            // Логіка Slovko:
            // Пропонуємо оновлення, якщо:
            // 1. Раніше не відмовлялися
            // 2. АБО вийшла версія НОВІША за ту, від якої відмовилися
            // 3. АБО минуло більше 5 днів
            if (!refusedV || isNewer(serverV, refusedV) || (now - refusedAt > COOLDOWN)) {
                versionStore.setVersion(serverV);
                versionStore.setUpdate(true);
            }
        }
    } catch (e) { console.error("Update check failed", e); }
}

/** Процес глибокого очищення та перезапуску */
export async function applyUpdateAndDeepClean() {
    try {
        // 1. Очищення браузерного кешу (Service Workers + Cache API)
        if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }

        // 2. Очищення Web Storage (localStorage, sessionStorage, IndexedDB)
        localStorage.clear();
        sessionStorage.clear();

        // 3. Записуємо нову версію ПІСЛЯ очищення
        localStorage.setItem(LOCAL_V_KEY, versionStore.serverVersion);

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
        console.error("Relaunch failed", e);
        // Fallback: якщо щось пішло не так (наприклад, у браузері reload заблоковано)
        versionStore.setManualRestart(true);
    }
}

/** Відкласти оновлення (Slovko logic) */
export function skipUpdate() {
    localStorage.setItem(REFUSED_V_KEY, versionStore.serverVersion);
    localStorage.setItem(REFUSED_AT_KEY, Date.now().toString());
    versionStore.setUpdate(false);
}
