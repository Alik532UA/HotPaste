/**
 * Config State — Manages global application configuration (persisted to localStorage).
 */

import { DEFAULT_CONFIG, type AppConfig } from '../types';

let config = $state<AppConfig>(loadConfig());

export const configState = {
    get config() { return config; },
    
    setScale(scale: number) {
        config.scale = scale;
        saveConfig();
    },

    setDefaultModeSnippets(mode: 'full' | 'minimal') {
        config.defaultModeSnippets = mode;
        saveConfig();
    },

    setDefaultModeKeyboard(mode: 'full' | 'minimal') {
        config.defaultModeKeyboard = mode;
        saveConfig();
    },

    setToggleModeHotkey(mode: 'space_f11' | 'space' | 'f11') {
        config.toggleModeHotkey = mode;
        saveConfig();
    }
};

function loadConfig(): AppConfig {
    try {
        const stored = localStorage.getItem('hotpaste-config');
        if (stored) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        }
    } catch {
        // ignore parse errors
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(): void {
    try {
        localStorage.setItem('hotpaste-config', JSON.stringify(config));
    } catch {
        // ignore storage errors
    }
}
