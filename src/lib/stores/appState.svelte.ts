/**
 * Application State — Facade for specialized state modules.
 */

import { uiState } from './uiState.svelte';
import { fsState } from './fileSystemState.svelte';
import { configState } from './configState.svelte';
import { logService } from '../services/logService.svelte';
import { isTabHotkey, isCardHotkey, getHotkeyLabel, TAB_CODES } from '../utils/keyboardLayout';
import type { Card } from '../types';
import Fuse from 'fuse.js';

/** Fuse.js instance for fuzzy search */
const fuse = $derived(new Fuse(fsState.activeCards, {
    keys: [
        { name: 'name', weight: 1.0 },
        { name: 'fileName', weight: 0.7 },
        { name: 'content', weight: 0.4 }
    ],
    threshold: 0.35,
    distance: 100,
    ignoreLocation: true
}));

/** Facade for all application state */
export function getState() {
    return {
        // UI State
        get toastMessage() { return uiState.toastMessage; },
        get toastVisible() { return uiState.toastVisible; },
        get scale() { return uiState.scale; },
        get searchQuery() { return uiState.searchQuery; },
        get editingCardPath() { return uiState.editingCardPath; },
        get flashingCardPath() { return uiState.flashingCardPath; },
        get selectedCardIds() { return uiState.selectedCardIds; },
        get cardView() { return uiState.cardView; },
        get cardDensity() { return uiState.cardDensity; },
        get activeTabIndex() { return uiState.activeTabIndex; },
        get activeContextMenu() { return uiState.activeContextMenu; },
        get activeSettingsCard() { return uiState.activeSettingsCard; },
        get activeSettingsTab() { return uiState.activeSettingsTab; },
        get activeHotkeyPickerCard() { return uiState.activeHotkeyPickerCard; },
        get activeHotkeyConflict() { return uiState.activeHotkeyConflict; },
        get isSelectionMode() { return uiState.isSelectionMode; },
        get isMinimalMode() { return uiState.isMinimalMode; },
        
        // File System State
        get tabs() { return fsState.tabs; },
        get isConnected() { return fsState.isConnected; },
        get rootName() { return fsState.rootName; },
        get activeTab() { return fsState.activeTab; },
        get activeCards() { return fsState.activeCards; },
        get filteredCards() { return getFilteredCards(); },
        get selectedCards() { return fsState.activeCards.filter(c => uiState.selectedCardIds.has(c.id)); },
        get tabCount() { return fsState.tabs.length; },
        
        // Config State
        get config() { return configState.config; },
        
        // Utils
        getHotkeyLabel: (code: string) => getHotkeyLabel(code),
    };
}

// --- Combined / Derived logic ---

function getFilteredCards() {
    const query = uiState.searchQuery.trim();
    const cards = fsState.activeCards;
    if (!query) return cards;
    
    // Use fuzzy search
    return fuse.search(query).map(result => result.item);
}

// --- Proxy Actions (for backward compatibility) ---

export const showToast = uiState.showToast;
export const showFlash = uiState.showFlash;
export const setScale = (s: number) => { uiState.setScale(s); configState.setScale(uiState.scale); };
export const adjustScale = (d: number) => { uiState.adjustScale(d); configState.setScale(uiState.scale); };
export const setSearchQuery = uiState.setSearchQuery;
export const setCardView = uiState.setCardView;
export const setCardDensity = uiState.setCardDensity;
export const toggleCardView = uiState.toggleCardView;
export const selectTab = (i: number, isExplicit: boolean = true) => {
    const tab = fsState.tabs[i];
    uiState.selectTab(i, fsState.tabs.length, tab?.type, isExplicit);
};
export const selectTabByHotkey = (c: string) => {
    if (!isTabHotkey(c)) return false;
    const index = TAB_CODES.indexOf(c);
    const tab = fsState.tabs[index];
    // Hotkey press is an explicit user action, so we pass true for isExplicitClick
    return uiState.selectTabByHotkey(c, fsState.tabs.length, tab?.type, true);
};
export const toggleCardSelection = uiState.toggleCardSelection;
export const clearSelection = uiState.clearSelection;
export const selectAll = () => uiState.selectAll(getFilteredCards().map((c: Card) => c.id));

export const openContextMenu = uiState.openContextMenu;
export const closeContextMenu = uiState.closeContextMenu;
export const openSettings = uiState.openSettings;
export const closeSettings = uiState.closeSettings;
export const openTabSettings = uiState.openTabSettings;
export const closeTabSettings = uiState.closeTabSettings;
export const openHotkeyPicker = uiState.openHotkeyPicker;
export const closeHotkeyPicker = uiState.closeHotkeyPicker;
export const closeHotkeyConflict = uiState.closeHotkeyConflict;
export const startEditingCard = uiState.startEditingCard;
export const stopEditingCard = uiState.stopEditingCard;
export const setSelectionMode = uiState.setSelectionMode;
export const toggleSelectionMode = uiState.toggleSelectionMode;

export const connectDirectory = fsState.connectDirectory;
export const connectDefaultProject = fsState.connectDefaultProject;
export const refreshTabs = fsState.refreshTabs;
export const saveCard = fsState.saveCard;
export const deleteCard = fsState.deleteCard;
export const duplicateCard = fsState.duplicateCard;
export const moveCardToTab = fsState.moveCardToTab;
export const moveCard = fsState.moveCard;
export const moveCardRelative = fsState.moveCardRelative;
export const renamePhysicalFile = fsState.renamePhysicalFile;
export const createNewTab = fsState.createNewTab;
export const deleteTab = fsState.deleteTab;
export const renamePhysicalTab = fsState.renamePhysicalTab;
export const updateTabSettings = fsState.updateTabSettings;
export const updateTabAssignment = fsState.updateTabAssignment;
export const duplicateTab = fsState.duplicateTab;
export const moveTab = fsState.moveTab;
export const toggleStrikethrough = fsState.toggleStrikethrough;
export const saveCurrentTabConfig = fsState.saveCurrentTabConfig;
export const saveTabOrder = fsState.saveTabOrder;
export const startNewCardCreation = fsState.startNewCardCreation;
export const removeOrphanedConfig = fsState.removeOrphanedConfig;
export const linkFileManually = fsState.linkFileManually;
export const updateCardHotkey = fsState.updateCardHotkey;
export const resetCardHotkeyToDefault = fsState.resetCardHotkeyToDefault;
export const resolveHotkeyConflict = fsState.resolveHotkeyConflict;
export const updateCardSettings = fsState.updateCardSettings;
export const copyCard = fsState.copyCard;
export const deleteSelectedCards = async () => {
    const ids = uiState.selectedCardIds;
    if (ids.size === 0) return;
    if (!confirm(`Ви впевнені, що хочете видалити ${ids.size} сніпетів?`)) return;
    const cardsToDelete = fsState.activeCards.filter(c => ids.has(c.id));
    for (const card of cardsToDelete) await fsState.deleteCard(card);
    uiState.clearSelection();
};
export const moveSelectedCardsToTab = async (target: string) => {
    const ids = uiState.selectedCardIds;
    if (ids.size === 0) return;
    const cardsToMove = fsState.activeCards.filter(c => ids.has(c.id));
    for (const card of cardsToMove) await fsState.moveCardToTab(card, target);
    uiState.clearSelection();
};

/** Copy a card's content by hotkey (physical code) */
export async function copyCardByHotkey(code: string): Promise<boolean> {
    const cards = fsState.activeCards.filter(c => c.hotkey === code);
    if (cards.length === 0) return false;

    if (cards.length > 1) {
        logService.log('appState', `Hotkey conflict detected for ${code}. Opening resolution modal.`);
        uiState.setHotkeyConflict(code, cards);
        return true;
    }

    await fsState.copyCard(cards[0]);
    return true;
}

// --- Keyboard handler ---

export function handleGlobalKeydown(event: KeyboardEvent): void {
    const activeEl = document.activeElement;
    const isInput = activeEl && (
        ['INPUT', 'TEXTAREA'].includes(activeEl.tagName.toUpperCase()) ||
        (activeEl as HTMLElement).isContentEditable
    );

    if (isInput || event.defaultPrevented) return;

    if (
        uiState.editingCardPath || 
        uiState.activeSettingsCard || 
        uiState.activeSettingsTab || 
        uiState.activeHotkeyPickerCard || 
        uiState.activeHotkeyConflict
    ) return;

    if (!fsState.isConnected) return;

    if (event.ctrlKey && event.code === 'KeyN') {
        event.preventDefault();
        fsState.startNewCardCreation();
        return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.code === 'Escape') {
        event.preventDefault();
        import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('hide_window').catch(() => {
                import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
                    getCurrentWindow().hide();
                });
            });
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
    if (selectTabByHotkey(code)) {
        event.preventDefault();
        return;
    }

    if (isCardHotkey(code)) {
        event.preventDefault();
        copyCardByHotkey(code);
    }
}
