// src/lib/stores/versionStore.svelte.ts
let serverVersion = $state("0.0.0");
let isUpdateAvailable = $state(false);
let needsManualRestart = $state(false);

export const versionStore = {
    get serverVersion() { return serverVersion; },
    get isUpdateAvailable() { return isUpdateAvailable; },
    get needsManualRestart() { return needsManualRestart; },
    
    setVersion(v: string) { serverVersion = v; },
    setUpdate(status: boolean) { isUpdateAvailable = status; },
    setManualRestart(status: boolean) { needsManualRestart = status; }
};
