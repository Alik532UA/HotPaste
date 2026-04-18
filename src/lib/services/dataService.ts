import { t } from "../i18n";
import { storage } from "./storage";
import { logService } from "./logService.svelte";

export const dataService = {
    /**
     * Clears all local application data, including localStorage, sessionStorage,
     * cookies, Cache Storage, and IndexedDB.
     */
    async clearAllData() {
        storage.clear();
        sessionStorage.clear();
        
        // Clear cookies
        document.cookie.split(";").forEach((c) => {
            document.cookie = c
                .replace(/^ +/, "")
                .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        // Clear Cache Storage
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
        }

        // Clear IndexedDB
        if ('indexedDB' in window) {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
                if (db.name) {
                    try {
                        window.indexedDB.deleteDatabase(db.name);
                    } catch (e) {
                        logService.error('DataService', `Failed to delete DB: ${db.name} - ${e}`);
                    }
                }
            }
        }
    }
};
