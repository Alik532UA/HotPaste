/**
 * UI State — Manages modals, toasts, zoom, and view settings.
 */

import { logService } from '../services/logService.svelte';
import { configState } from './configState.svelte';
import { storage } from '../services/storage';
import { getHotkeyLabel, TAB_CODES, isTabHotkey } from '../utils/keyboardLayout';
import type { Card, ShortcutInfo, Tab } from '../types';

// --- State ---

let toastMessage = $state('');
let toastVisible = $state(false);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

let scale = $state(1.0);
let searchQuery = $state('');
let editingCardPath = $state('');
let flashingCardPath = $state('');
let selectedCardIds = $state<Set<string>>(new Set());
let isSelectionMode = $state(false);
let isMinimalMode = $state(false);
let activeSubfolderFilter = $state<string | 'all' | 'root'>('all');

let cardView = $state<'short' | 'full'>((storage.get('hp_card_view') as any) || 'short');
let cardDensity = $state<'expanded' | 'normal' | 'compact'>((storage.get('hp_card_density') as any) || 'normal');

let activeTabIndex = $state(0);

/** 
 * Centralized modal state container.
 * Each property is null when the modal is closed.
 */
let modals = $state({
    contextMenu: null as { x: number, y: number, card: Card } | null,
    settingsCard: null as Card | null,
    settingsTab: null as Tab | null,
    hotkeyPicker: null as { card: Card, onSelect?: (code: string) => void } | null,
    hotkeyConflict: null as { code: string, cards: Card[] } | null,
    programPicker: null as { key: string, tab: Tab } | null,
    iconPicker: null as { current: string, onSelect: (icon: string) => void, title?: string } | null,
    actionConfirmation: null as {
        card?: Card,
        assignment?: ShortcutInfo,
        key?: string,
        total: number,
        remaining: number,
        onConfirm: () => void
    } | null,
});

// --- Getters ---

export const uiState = {
    get toastMessage() { return toastMessage; },
    get toastVisible() { return toastVisible; },
    get scale() { return scale; },
    get searchQuery() { return searchQuery; },
    get editingCardPath() { return editingCardPath; },
    get flashingCardPath() { return flashingCardPath; },
    get selectedCardIds() { return selectedCardIds; },
    get isSelectionMode() { return isSelectionMode; },
    get isMinimalMode() { return isMinimalMode; },
    get activeSubfolderFilter() { return activeSubfolderFilter; },
    get cardView() { return cardView; },
    get cardDensity() { return cardDensity; },
    get activeTabIndex() { return activeTabIndex; },
    
    // Modals getters
    get activeContextMenu() { return modals.contextMenu; },
    get activeSettingsCard() { return modals.settingsCard; },
    get activeSettingsTab() { return modals.settingsTab; },
    get activeHotkeyPicker() { return modals.hotkeyPicker; },
    get activeHotkeyConflict() { return modals.hotkeyConflict; },
    get activeProgramPicker() { return modals.programPicker; },
    get activeIconPicker() { return modals.iconPicker; },
    get activeActionConfirmation() { return modals.actionConfirmation; },
    
    // Actions
    showToast,
    showFlash,
    setScale,
    adjustScale,
    setSearchQuery,
    setCardView,
    setCardDensity,
    toggleCardView,
    toggleCardDensity,
    setSelectionMode,
    toggleSelectionMode,
    toggleMinimalMode,
    setMinimalMode,
    setActiveSubfolderFilter,
    selectTab,
    selectTabByHotkey,
    toggleCardSelection,
    clearSelection,
    selectAll,
    openContextMenu,
    closeContextMenu,
    openSettings,
    closeSettings,
    openTabSettings,
    closeTabSettings,
    openHotkeyPicker,
    closeHotkeyPicker,
    closeHotkeyConflict,
    setHotkeyConflict,
    openProgramPicker,
    closeProgramPicker,
    openIconPicker,
    closeIconPicker,
    openActionConfirmation,
    confirmActionStep,
    closeActionConfirmation,
    startEditingCard,
    stopEditingCard,
};

// --- Action Implementations ---

function openActionConfirmation(params: { card?: Card, assignment?: ShortcutInfo, key?: string, total: number, onConfirm: () => void }): void {
    logService.info('ui', `Opening action confirmation for key: ${params.key}, total steps: ${params.total}`);
    modals.actionConfirmation = {
        ...params,
        remaining: params.total - 1 // First press already happened
    };
}

function confirmActionStep(): void {
    if (modals.actionConfirmation) {
        modals.actionConfirmation.remaining--;
        logService.info('ui', `Confirmation step confirmed. Remaining: ${modals.actionConfirmation.remaining}`);
        
        if (modals.actionConfirmation.remaining <= 0) {
            logService.info('ui', 'Confirmation complete. Executing final action.');
            modals.actionConfirmation.onConfirm();
            
            // Delay clearing the state slightly so that the current keydown event 
            // finishes propagation while the "blocker" is still active.
            setTimeout(() => {
                modals.actionConfirmation = null;
            }, 100);
        }
    } else {
        logService.warn('ui', 'confirmActionStep called but no activeActionConfirmation found');
    }
}

function closeActionConfirmation(): void {
    modals.actionConfirmation = null;
}

function setActiveSubfolderFilter(filter: string | 'all' | 'root'): void {
    activeSubfolderFilter = filter;
}

function openIconPicker(current: string, onSelect: (icon: string) => void, title?: string): void {
    modals.iconPicker = { current, onSelect, title };
}

function closeIconPicker(): void {
    modals.iconPicker = null;
}

function openProgramPicker(key: string, tab: Tab): void {
    modals.programPicker = { key, tab };
}

function closeProgramPicker(): void {
    modals.programPicker = null;
}

function showToast(message: string): void {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage = message;
    toastVisible = true;
    toastTimeout = setTimeout(() => {
        toastVisible = false;
    }, 1500);
}

function showFlash(cardPath: string): void {
    flashingCardPath = cardPath;
    setTimeout(() => {
        flashingCardPath = '';
    }, 400);
}

function setScale(newScale: number): void {
    scale = Math.max(0.5, Math.min(2.0, newScale));
}

function adjustScale(delta: number): void {
    setScale(scale + delta);
}

function setSearchQuery(query: string): void {
    searchQuery = query;
}

function setCardView(view: 'short' | 'full'): void {
    cardView = view;
    storage.set('hp_card_view', view);
}

function setCardDensity(density: 'expanded' | 'normal' | 'compact'): void {
    cardDensity = density;
    storage.set('hp_card_density', density);
}

function toggleCardView(): void {
    setCardView(cardView === 'short' ? 'full' : 'short');
}

function toggleCardDensity(): void {
    const densities: Array<'expanded' | 'normal' | 'compact'> = ['expanded', 'normal', 'compact'];
    const currentIndex = densities.indexOf(cardDensity);
    const nextIndex = (currentIndex + 1) % densities.length;
    setCardDensity(densities[nextIndex]);
}

function toggleMinimalMode(): void {
    isMinimalMode = !isMinimalMode;
    logService.info('ui', `toggleMinimalMode: isMinimalMode=${isMinimalMode}`);
}

function setMinimalMode(value: boolean): void {
    logService.info('ui', `setMinimalMode: value=${value}, current=${isMinimalMode}`);
    isMinimalMode = value;
}

function selectTab(index: number, max: number, tabType?: 'snippets' | 'keyboard', isExplicitClick: boolean = false): void {
    logService.info('ui', `selectTab: index=${index}, tabType=${tabType}, currentActive=${activeTabIndex}, isExplicit=${isExplicitClick}`);
    if (index >= 0 && index < max) {
        if (index !== activeTabIndex) {
            activeTabIndex = index;
            activeSubfolderFilter = 'all';
            // Use defaults from config
            if (tabType === 'keyboard') {
                isMinimalMode = configState.config.defaultModeKeyboard === 'minimal';
            } else if (tabType === 'snippets') {
                isMinimalMode = configState.config.defaultModeSnippets === 'minimal';
            }
            logService.info('ui', `selectTab (switch): isMinimalMode=${isMinimalMode} (type=${tabType})`);
        }
    }
}

function selectTabByHotkey(code: string, max: number, tabType: 'snippets' | 'keyboard' = 'snippets', isExplicitClick: boolean = false): boolean {
    if (!isTabHotkey(code)) return false;
    const index = TAB_CODES.indexOf(code);
    if (index >= 0 && index < max) {
        selectTab(index, max, tabType, isExplicitClick);
        return true;
    }
    return false;
}

function toggleCardSelection(id: string): void {
    const next = new Set(selectedCardIds);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    selectedCardIds = next;
}

function setSelectionMode(value: boolean): void {
    isSelectionMode = value;
    if (!value) {
        selectedCardIds.clear();
    }
}

function toggleSelectionMode(): void {
    setSelectionMode(!isSelectionMode);
}

function clearSelection(): void {
    selectedCardIds.clear();
    isSelectionMode = false;
}

function selectAll(ids: string[]): void {
    selectedCardIds = new Set(ids);
}

function openContextMenu(x: number, y: number, card: Card): void {
    modals.contextMenu = { x, y, card };
}

function closeContextMenu(): void {
    modals.contextMenu = null;
}

function openSettings(card: Card): void {
    modals.settingsCard = card;
}

function closeSettings(): void {
    modals.settingsCard = null;
}

function openTabSettings(tab: Tab): void {
    modals.settingsTab = tab;
}

function closeTabSettings(): void {
    modals.settingsTab = null;
}

function openHotkeyPicker(card: Card, onSelect?: (code: string) => void): void {
    modals.hotkeyPicker = { card, onSelect };
}

function closeHotkeyPicker(): void {
    modals.hotkeyPicker = null;
}

function closeHotkeyConflict(): void {
    modals.hotkeyConflict = null;
}

function setHotkeyConflict(code: string, cards: Card[]): void {
    modals.hotkeyConflict = { code, cards };
}

function startEditingCard(card: Card): void {
    editingCardPath = card.filePath;
}

function stopEditingCard(): void {
    editingCardPath = '';
}
