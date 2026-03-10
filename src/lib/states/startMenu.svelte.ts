import { TauriFileSystemService } from '../services/tauriFileSystem';
import { logService } from '../services/logService.svelte';
import type { ShortcutInfo } from '../types';

const fs = new TauriFileSystemService();

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

            // 2. Fetch icons for assignments first (highest priority)
            this.loadAssignmentIcons();

        } catch (err) {
            logService.error('startMenu', 'Failed to refresh shortcuts', err);
        }
    }

    /**
     * Call this when a category becomes active to load its icons
     */
    async loadIconsForCategory(category: 'local' | 'running' | 'system') {
        const list = category === 'local' ? this.availableShortcuts : 
                     category === 'running' ? this.runningProcesses : 
                     this.systemShortcuts;
        
        await this.loadIconsForList(list);
    }

    private async loadAssignmentIcons() {
        const pathsToFetch = Object.values(this.assignments)
            .filter(a => {
                // Skip if icon already exists
                if (a.icon) return false;
                
                // Detect if it's a protocol/URI (starts with scheme: or contains : without slashes/spaces)
                const isProtocol = a.path.startsWith('ms-settings:') || 
                                   a.path.startsWith('http://') || 
                                   a.path.startsWith('https://') || 
                                   a.path.startsWith('mailto:') || 
                                   a.path.startsWith('tel:');
                
                const isUriLike = isProtocol || (
                    a.path.includes(':') && 
                    !a.path.includes('\\') && 
                    !a.path.includes('/') && 
                    !a.path.includes(' ')
                );

                return !isUriLike;
            })
            .map(a => a.path);
        
        if (pathsToFetch.length === 0) return;

        logService.debug('startMenu', `Loading icons for ${pathsToFetch.length} assignments`);
        
        // Update assignments with icons once loaded
        for (const key in this.assignments) {
            const assignment = this.assignments[key];
            if (!assignment.icon) {
                // Check again for URI to skip individual invoke
                const isProtocol = assignment.path.startsWith('ms-settings:') || 
                                   assignment.path.startsWith('http://') || 
                                   assignment.path.startsWith('https://') || 
                                   assignment.path.startsWith('mailto:') || 
                                   assignment.path.startsWith('tel:');
                
                const isUriLike = isProtocol || (
                    assignment.path.includes(':') && 
                    !assignment.path.includes('\\') && 
                    !assignment.path.includes('/') && 
                    !assignment.path.includes(' ')
                );

                if (isUriLike) continue;

                try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const icon = await invoke<string>('get_shortcut_icon', { path: assignment.path });
                    if (icon) assignment.icon = icon;
                } catch (err) {
                    logService.error('startMenu', `Failed to load icon for assigned key ${key}`, err);
                }
            }
        }
    }

    private async loadIconsForList(list: ShortcutInfo[]) {
        if (list.length === 0) return;
        
        const { invoke } = await import('@tauri-apps/api/core');
        const category = list[0].type || 'unknown';
        
        // Check if we already have icons for most items
        const itemsToFetch = list.filter(item => !item.icon);
        if (itemsToFetch.length === 0) return;

        logService.debug('startMenu', `Loading icons for ${category} (${itemsToFetch.length} items remaining)`);

        // Use CHUNK_SIZE = 1 to show icons in UI one-by-one as they load
        const CHUNK_SIZE = 1;
        for (let i = 0; i < itemsToFetch.length; i += CHUNK_SIZE) {
            const chunk = itemsToFetch.slice(i, i + CHUNK_SIZE);
            const paths = chunk.map(item => item.path);
            
            logService.debug('startMenu', `Sending ${paths.length} paths to backend for icons`, paths);
            
            try {
                const results = await invoke<[string, string][]>('get_shortcut_icons_batch', { paths });
                
                const iconMap = new Map(results);
                let updatedCount = 0;
                
                for (const item of chunk) {
                    const icon = iconMap.get(item.path);
                    if (icon) {
                        item.icon = icon;
                        updatedCount++;
                    }
                }
            } catch (err) {
                logService.error('startMenu', `Batch icon load failed for chunk in ${category}`, err);
            }
        }
        
        logService.info('startMenu', `Finished loading icons for ${category}`);
    }

    assignKey(keyCode: string, shortcut: ShortcutInfo | 'none') {
        if (shortcut === 'none') {
            delete this.assignments[keyCode];
        } else {
            this.assignments[keyCode] = shortcut;
        }
        this.saveAssignments();
    }

    setAssignments(newAssignments: Record<string, ShortcutInfo>) {
        this.assignments = { ...newAssignments };
    }

    async launchKey(keyCode: string) {
        const shortcut = this.assignments[keyCode];
        if (!shortcut) return;

        try {
            const { invoke } = await import('@tauri-apps/api/core');
            
            // Strictly define what goes to shell.open (standard web protocols ONLY)
            const isWebUrl = shortcut.path.startsWith('http://') || 
                             shortcut.path.startsWith('https://') || 
                             shortcut.path.startsWith('mailto:') || 
                             shortcut.path.startsWith('tel:');
            
            // Detect if it's any other URI/protocol (e.g. ms-settings:)
            const isOtherUri = !isWebUrl && shortcut.path.includes(':') && 
                               !shortcut.path.includes('\\') && 
                               !shortcut.path.includes('/') && 
                               !shortcut.path.includes(' ');

            if (isWebUrl) {
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(shortcut.path);
            } else if (isOtherUri) {
                // For custom protocols like ms-settings:, always use our Rust handler
                // which is not subject to Tauri shell plugin security regex.
                await invoke('launch_program_by_path', { path: shortcut.path });
            } else if (shortcut.type === 'local') {
                await invoke('launch_start_program', { name: shortcut.path });
            } else {
                // This covers 'commands', 'running', 'system' types
                await invoke('launch_program_by_path', { path: shortcut.path });
            }
            logService.log('startMenu', `Launched: ${shortcut.name}`);
        } catch (err) {
            logService.error('startMenu', `Failed to launch ${shortcut.name}`, err);
        }
    }
}

export const startMenuState = new StartMenuState();
