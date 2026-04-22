import { t } from "../i18n";
import { storage } from "./storage";
import { sessionStore } from "./sessionStore";
import { logService } from "./logService.svelte";

export const dataService = {
    /**
     * Clears all local application data, including localStorage, sessionStorage,
     * cookies, Cache Storage, and IndexedDB for the current namespace.
     */
    async clearAllData() {
        storage.clear();
        sessionStore.clear();
        
        // Clear cookies (only those scoped to this app if we had specific ones, but here we just clear our prefix)
        // Note: document.cookie API is bad for partial clearing, so we clear what we can find with hotpaste_ prefix
        document.cookie.split(";").forEach((c) => {
            const cookieName = c.replace(/^ +/, "").split('=')[0];
            if (cookieName.startsWith('hotpaste_')) {
                document.cookie = cookieName + "=;expires=" + new Date().toUTCString() + ";path=/";
            }
        });

        // Clear Cache Storage (only ours)
        if ('caches' in window) {
            const names = await caches.keys();
            const ourCaches = names.filter(name => name.includes('hotpaste'));
            await Promise.all(ourCaches.map(name => caches.delete(name)));
        }

        // Clear IndexedDB (only ours)
        if ('indexedDB' in window) {
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
                if (db.name && db.name.includes('hotpaste')) {
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
