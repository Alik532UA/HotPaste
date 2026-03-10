import { t } from "../i18n";

export const dataService = {
    /**
     * Clears all local application data, including localStorage, sessionStorage,
     * cookies, Cache Storage, and IndexedDB.
     */
    async clearAllData() {
        if (!confirm(t.settings.clearCacheConfirm)) {
            return;
        }

        localStorage.clear();
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
            dbs.forEach(db => {
                if (db.name) window.indexedDB.deleteDatabase(db.name);
            });
        }

        window.location.reload();
    }
};
