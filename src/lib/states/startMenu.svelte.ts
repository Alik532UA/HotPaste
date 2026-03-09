import { TauriFileSystemService } from '../services/tauriFileSystem';
import { logService } from '../services/logService.svelte';

const fs = new TauriFileSystemService();

export interface ShortcutInfo {
    name: string;
    path: string;
    type?: 'local' | 'running' | 'system';
    icon?: string | null;
}

/**
 * Start Menu State — Manages virtual keyboard assignments and program launching.
 */
class StartMenuState {
    /** Mapping of physical key codes to shortcut info */
    assignments = $state<Record<string, ShortcutInfo>>({});
    
    /** List of available .lnk files in Documents/HotPaste/start */
    availableShortcuts = $state<ShortcutInfo[]>([]);

    /** List of currently running processes */
    runningProcesses = $state<ShortcutInfo[]>([]);

    /** List of system start menu shortcuts */
    systemShortcuts = $state<ShortcutInfo[]>([]);

    constructor() {
        this.loadAssignments();
    }

    private loadAssignments() {
        const stored = localStorage.getItem('hotpaste-start-assignments');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Migration: if it's old format (string), convert to ShortcutInfo
                for (const key in parsed) {
                    if (typeof parsed[key] === 'string') {
                        parsed[key] = { name: parsed[key].split('.')[0], path: parsed[key], type: 'local' };
                    }
                }
                this.assignments = parsed;
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
            const { invoke } = await import('@tauri-apps/api/core');
            
            logService.info('startMenu', 'Fetching shortcut metadata...');

            // 1. Fetch metadata only (very fast)
            const local = await invoke<ShortcutInfo[]>('get_local_shortcuts');
            this.availableShortcuts = local.map(s => ({ ...s, type: 'local' }));
            
            const running = await invoke<ShortcutInfo[]>('get_running_processes');
            this.runningProcesses = running.map(s => ({ ...s, type: 'running' }));
            
            const system = await invoke<ShortcutInfo[]>('get_system_shortcuts');
            this.systemShortcuts = system.map(s => ({ ...s, type: 'system' }));

            logService.info('startMenu', `Metadata loaded: ${local.length} local, ${running.length} running, ${system.length} system`);

            // 2. Start fetching icons in background (don't await)
            this.fetchAllIcons();

        } catch (err) {
            logService.error('startMenu', 'Failed to refresh shortcuts', err);
        }
    }

    private async fetchAllIcons() {
        // We load icons in parallel batches to speed up but not freeze
        await Promise.all([
            this.loadIconsForList(this.availableShortcuts),
            this.loadIconsForList(this.runningProcesses),
            this.loadIconsForList(this.systemShortcuts)
        ]);
        logService.info('startMenu', 'All icons loaded');
    }

    private async loadIconsForList(list: ShortcutInfo[]) {
        const { invoke } = await import('@tauri-apps/api/core');
        
        // Load one by one to keep UI responsive and show progress
        for (const item of list) {
            if (item.icon) continue; // Skip if already has icon
            try {
                const iconBase64 = await invoke<string>('get_shortcut_icon', { path: item.path });
                if (iconBase64) {
                    item.icon = iconBase64;
                }
            } catch (err) {
                // Silently skip if icon fails
            }
        }
    }

    assignKey(keyCode: string, shortcut: ShortcutInfo | 'none') {
        if (shortcut === 'none') {
            delete this.assignments[keyCode];
        } else {
            this.assignments[keyCode] = shortcut;
        }
        this.saveAssignments();
    }

    async launchKey(keyCode: string) {
        const shortcut = this.assignments[keyCode];
        if (!shortcut) return;

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            if (shortcut.type === 'local') {
                await invoke('launch_start_program', { name: shortcut.path });
            } else {
                await invoke('launch_program_by_path', { path: shortcut.path });
            }
            logService.log('startMenu', `Launched: ${shortcut.name}`);
        } catch (err) {
            logService.error('startMenu', `Failed to launch ${shortcut.name}`, err);
        }
    }
}

export const startMenuState = new StartMenuState();
