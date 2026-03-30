/**
 * Hotkey State — Handles global keyboard shortcuts and card/assignment actions.
 */

import { uiState } from './uiState.svelte';
import { fsState } from './fileSystemState.svelte';
import { configState } from './configState.svelte';
import { logService } from '../services/logService.svelte';
import { isTabHotkey, isCardHotkey, TAB_CODES } from '../utils/keyboardLayout';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Card } from '../types';

/** 
 * Centralized hotkey and global event state handler.
 */
export const hotkeyState = {
    quickPasteFromClipboard,
    copyCardByHotkey,
    handleGlobalKeydown,
    updateKeyMap: (_cards: Card[]) => { /* No-op in new dynamic hotkey resolution mode */ }
};

/** Create a new card from clipboard content automatically */
async function quickPasteFromClipboard() {
    try {
        let text = '';
        
        // Determine if running in Tauri environment
        // @ts-ignore
        const isTauri = !!(typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__));

        if (isTauri) {
            text = await readText();
        } else {
            text = await navigator.clipboard.readText();
        }

        if (!text || text.trim() === '') {
            uiState.showToast('Буфер обміну порожній');
            return;
        }

        // Create a mock card structure for saveCard
        const tempId = `quick-new-${Date.now()}`;
        const mockCard: Card = {
            id: tempId, 
            name: "New Snippet", 
            fileName: "", 
            filePath: tempId, 
            content: text, 
            extension: "txt",
            displayName: null, 
            hotkey: '', 
            icon: null, 
            color: null, 
            borderColor: null, 
            strikethrough: [],
            subfolder: null,
            size: 0, 
            lastModified: 0, 
            isNewMock: true
        };

        await fsState.saveCard(mockCard, text);
    } catch (err) {
        logService.log('error', 'Failed to quick paste', err);
        uiState.showToast('Помилка доступу до буфера обміну');
    }
}

/** Trigger a card or assignment action by hotkey, with confirmation support */
async function copyCardByHotkey(code: string): Promise<boolean> {
    const activeTab = fsState.tabs[uiState.activeTabIndex];
    if (!activeTab) return false;

    logService.debug('app', `copyCardByHotkey: code=${code}, tabType=${activeTab.type}`);

    // Handle Keyboard Tab
    if (activeTab.type === 'keyboard') {
        const assignment = activeTab.assignments?.[code];
        if (assignment) {
            const confirmCount = assignment.confirmCount || 1;
            logService.info('app', `Assignment found for ${code}: ${assignment.name}, confirmCount=${confirmCount}`);

            const executeAction = () => {
                logService.info('app', `Executing assignment action: ${assignment.name} (${assignment.path})`);
                invoke('launch_program_by_path', { path: assignment.path }).catch(err => 
                    logService.error('app', `Failed to launch: ${assignment.path}`, err)
                );
                // Hide window after successful launch (like Start Menu)
                invoke('hide_window').catch(() => {
                    getCurrentWindow().hide();
                });
            };

            if (confirmCount > 1) {
                logService.info('app', `Opening confirmation modal for assignment (total presses needed: ${confirmCount})`);
                uiState.openActionConfirmation({
                    assignment,
                    key: code,
                    total: confirmCount,
                    onConfirm: executeAction
                });
                return true; // Modal is open, wait for further presses
            } else {
                executeAction();
                return true;
            }
        }
        return false;
    }

    // Handle Snippets Tab
    const cards = activeTab.cards.filter(c => c.hotkey === code);
    if (cards.length === 0) return false;

    if (cards.length > 1) {
        logService.warn('app', `Hotkey conflict detected for ${code}. Opening resolution modal.`);
        uiState.setHotkeyConflict(code, cards);
        return true;
    }

    const card = cards[0];
    const confirmCount = card.confirmCount || 1;
    logService.info('app', `Card found for ${code}: ${card.name}, confirmCount=${confirmCount}`);

    const executeAction = () => {
        logService.info('app', `Executing card copy action: ${card.name}`);
        fsState.copyCard(card);
    };

    if (confirmCount > 1) {
        logService.info('app', `Opening confirmation modal for card (total presses needed: ${confirmCount})`);
        uiState.openActionConfirmation({
            card,
            key: code,
            total: confirmCount,
            onConfirm: executeAction
        });
        return true; // Modal is open, wait for further presses
    } else {
        await executeAction();
        return true;
    }
}

/** Global keydown handler for the whole application */
function handleGlobalKeydown(event: KeyboardEvent): void {
    // 1. SYSTEMIC FIX: Robust input detection
    const target = event.target as HTMLElement;
    const isInput = target && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || 
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]')
    );

    if (isInput || event.defaultPrevented) return;

    // 2. Block hotkeys when modals are open
    if (
        uiState.editingCardPath ||
        uiState.activeSettingsCard ||
        uiState.activeSettingsTab ||
        uiState.activeHotkeyPicker ||
        uiState.activeHotkeyConflict ||
        uiState.activeIconPicker ||
        uiState.activeProgramPicker ||
        uiState.activeActionConfirmation
    ) return;
    if (!fsState.isConnected) return;

    // Quick paste from clipboard on Ctrl+V
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyV') {
        event.preventDefault();
        quickPasteFromClipboard();
        return;
    }

    if (event.ctrlKey && event.code === 'KeyN') {
        event.preventDefault();
        fsState.startNewCardCreation();
        return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.code === 'Escape') {
        event.preventDefault();
        invoke('hide_window').catch(() => {
            getCurrentWindow().hide();
        });
        return;
    }

    // Toggle Minimal/Full mode
    const toggleConfig = configState.config.toggleModeHotkey;
    const isSpace = event.code === 'Space';
    const isF11 = event.code === 'F11';

    const shouldToggle = 
        (toggleConfig === 'space_f11' && (isSpace || isF11)) ||
        (toggleConfig === 'space' && isSpace) ||
        (toggleConfig === 'f11' && isF11);

    if (shouldToggle) {
        event.preventDefault();
        uiState.toggleMinimalMode();
        return;
    }

    const code = event.code;

    // 3. Tab Navigation (1-9 or Arrows)
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
        const tabCount = fsState.tabs.length;
        if (tabCount > 1) {
            event.preventDefault();
            const direction = code === 'ArrowLeft' ? -1 : 1;
            const nextIndex = (uiState.activeTabIndex + direction + tabCount) % tabCount;
            const tab = fsState.tabs[nextIndex];
            uiState.selectTab(nextIndex, fsState.tabs.length, tab?.type, true);
        }
        return;
    }

    if (isTabHotkey(code)) {
        const index = TAB_CODES.indexOf(code);
        const tab = fsState.tabs[index];
        if (tab) {
            event.preventDefault();
            uiState.selectTab(index, fsState.tabs.length, tab.type, true);
            return;
        }
    }

    if (isCardHotkey(code)) {
        event.preventDefault();
        copyCardByHotkey(code);
    }
}
