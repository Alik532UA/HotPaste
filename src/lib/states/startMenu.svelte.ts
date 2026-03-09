import { TauriFileSystemService } from '../services/tauriFileSystem';
import { logService } from '../services/logService.svelte';

const fs = new TauriFileSystemService();

/**
 * Start Menu State — Manages virtual keyboard assignments and program launching.
 */
class StartMenuState {
    /** Mapping of physical key codes to shortcut filenames (.lnk) */
    assignments = $state<Record<string, string>>({});
    
    /** List of available .lnk files in Documents/HotPaste/start */
    availableShortcuts = $state<string[]>([]);

    constructor() {
        this.loadAssignments();
    }

    private loadAssignments() {
        const stored = localStorage.getItem('hotpaste-start-assignments');
        if (stored) {
            try {
                this.assignments = JSON.parse(stored);
            } catch (err) {
                logService.error('startMenu', 'Failed to parse assignments', err);
            }
        }
    }

    private saveAssignments() {
        localStorage.setItem('hotpaste-start-assignments', JSON.stringify(this.assignments));
    }

    async refreshShortcuts() {
        // @ts-ignore
        const isTauri = !!(typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__));
        if (!isTauri) return;

        try {
            await fs.requestAccess();
            this.availableShortcuts = await fs.getStartShortcuts();
            logService.log('startMenu', `Refreshed shortcuts: ${this.availableShortcuts.length} found`);
        } catch (err) {
            logService.error('startMenu', 'Failed to refresh shortcuts', err);
        }
    }

    assignKey(keyCode: string, shortcutName: string) {
        if (shortcutName === 'none') {
            delete this.assignments[keyCode];
        } else {
            this.assignments[keyCode] = shortcutName;
        }
        this.saveAssignments();
    }

    async launchKey(keyCode: string) {
        const shortcut = this.assignments[keyCode];
        if (!shortcut) return;

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('launch_start_program', { name: shortcut });
            logService.log('startMenu', `Launched via Rust: ${shortcut}`);
        } catch (err) {
            logService.error('startMenu', `Failed to launch ${shortcut}`, err);
        }
    }
}

export const startMenuState = new StartMenuState();
