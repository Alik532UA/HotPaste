/**
 * Config State — Manages global application configuration (persisted to localStorage).
 */

import { DEFAULT_CONFIG, type AppConfig } from '../types';
import { storage } from '../services/storage';
import { getWinVK } from '../utils/keyboardLayout';
import { invoke } from '@tauri-apps/api/core';
import { logService } from '../services/logService.svelte';

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
    },

    async setAutostartEnabled(enabled: boolean) {
        config.autostartEnabled = enabled;
        saveConfig();
        try {
            const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
            if (enabled) {
                if (!(await isEnabled())) await enable();
            } else {
                if (await isEnabled()) await disable();
            }
        } catch (e) {
            logService.error('Config', `Failed to set autostart: ${e}`);
        }
    },

    setTriggerKey(key: string) {
        config.triggerKey = key;
        saveConfig();
        
        // Sync with Tauri hook worker
        const { vk, alt } = getWinVK(key);
        invoke('restart_hook_worker_tauri', { vkCode: vk, useAlt: alt })
            .catch(e => logService.error('Config', `Failed to restart hook worker: ${e}`));
    },

    setFontFamily(font: string) {
        config.fontFamily = font;
        saveConfig();
    },

    setFontMd(font: string) {
        config.fontMd = font;
        saveConfig();
    },

    setFontTxt(font: string) {
        config.fontTxt = font;
        saveConfig();
    },

    setFontHotkey(font: string) {
        config.fontHotkey = font;
        saveConfig();
    }
};

function loadConfig(): AppConfig {
    try {
        const stored = storage.get('hotpaste-config');
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
        storage.set('hotpaste-config', JSON.stringify(config));
    } catch {
        // ignore storage errors
    }
}
