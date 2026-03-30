/**
 * Application State — Facade for specialized state modules.
 * This is the primary entry point for UI components to access state and actions.
 */

import { uiState } from './uiState.svelte';
import { fsState } from './fileSystemState.svelte';
import { configState } from './configState.svelte';
import { hotkeyState } from './hotkeyState.svelte';
import { getHotkeyLabel, TAB_CODES, isTabHotkey } from '../utils/keyboardLayout';
import type { Card } from '../types';
import Fuse from 'fuse.js';

/** Fuse.js instance for fuzzy search (computed based on active cards) */
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

/** 
 * Centralized getter for all application state.
 * Components should call this to get reactive access to all stores.
 */
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
        get activeHotkeyPicker() { return uiState.activeHotkeyPicker; },
        get activeHotkeyConflict() { return uiState.activeHotkeyConflict; },
        get activeIconPicker() { return uiState.activeIconPicker; },
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

/** Performs filtering and fuzzy search on the active cards */
function getFilteredCards() {
    const query = uiState.searchQuery.trim();
    const filter = uiState.activeSubfolderFilter;
    let cards = fsState.activeCards;
    
    // Initial filtering by subfolder if no search query
    if (!query) {
        if (filter === 'root') {
            return cards.filter(c => c.subfolder === null);
        } else if (filter !== 'all') {
            return cards.filter(c => c.subfolder === filter);
        }
        return cards;
    }
    
    // Use fuzzy search
    const results = fuse.search(query).map(result => result.item);
    
    // Filter search results by subfolder
    if (filter === 'root') {
        return results.filter(c => c.subfolder === null);
    } else if (filter !== 'all') {
        return results.filter(c => c.subfolder === filter);
    }
    
    return results;
}

// --- Re-exports (Proxy Actions) ---

// UI Actions
export const showToast = uiState.showToast;
export const showFlash = uiState.showFlash;
export const setScale = (s: number) => { uiState.setScale(s); configState.setScale(uiState.scale); };
export const adjustScale = (d: number) => { uiState.adjustScale(d); configState.setScale(uiState.scale); };
export const setSearchQuery = uiState.setSearchQuery;
export const setCardView = uiState.setCardView;
export const setCardDensity = uiState.setCardDensity;
export const toggleCardView = uiState.toggleCardView;
export const toggleCardDensity = uiState.toggleCardDensity;
export const selectTab = (i: number, isExplicit: boolean = true) => {
    const tab = fsState.tabs[i];
    uiState.selectTab(i, fsState.tabs.length, tab?.type, isExplicit);
};
export const selectTabByHotkey = (c: string) => {
    if (!isTabHotkey(c)) return false;
    const index = TAB_CODES.indexOf(c);
    const tab = fsState.tabs[index];
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
export const openIconPicker = uiState.openIconPicker;
export const closeIconPicker = uiState.closeIconPicker;
export const startEditingCard = uiState.startEditingCard;
export const stopEditingCard = uiState.stopEditingCard;
export const setSelectionMode = uiState.setSelectionMode;
export const toggleSelectionMode = uiState.toggleSelectionMode;
export const toggleMinimalMode = uiState.toggleMinimalMode;
export const setMinimalMode = uiState.setMinimalMode;

// File System Actions
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
export const openTabInExplorer = fsState.openTabInExplorer;
export const removeOrphanedConfig = fsState.removeOrphanedConfig;
export const linkFileManually = fsState.linkFileManually;
export const updateCardHotkey = fsState.updateCardHotkey;
export const resetCardHotkeyToDefault = fsState.resetCardHotkeyToDefault;
export const resolveHotkeyConflict = fsState.resolveHotkeyConflict;
export const updateCardSettings = fsState.updateCardSettings;
export const copyCard = fsState.copyCard;

// Batch Actions
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

// Keyboard Actions (proxied from hotkeyState)
export const handleGlobalKeydown = hotkeyState.handleGlobalKeydown;
export const copyCardByHotkey = hotkeyState.copyCardByHotkey;
export const quickPasteFromClipboard = hotkeyState.quickPasteFromClipboard;
