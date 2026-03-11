/**
 * UI State — Manages modals, toasts, zoom, and view settings.
 */

import { logService } from '../services/logService.svelte';
import { configState } from './configState.svelte';
import { getHotkeyLabel, TAB_CODES, isTabHotkey } from '../utils/keyboardLayout';
import type { Card, Tab } from '../types';

// --- State ---

// Better environment check for Tauri v2
const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);

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

let cardView = $state<'short' | 'full'>((localStorage.getItem('hp_card_view') as any) || 'short');
let cardDensity = $state<'expanded' | 'normal' | 'compact'>((localStorage.getItem('hp_card_density') as any) || 'normal');

let activeTabIndex = $state(0);
let activeContextMenu = $state<{ x: number, y: number, card: Card } | null>(null);
let activeSettingsCard = $state<Card | null>(null);
let activeSettingsTab = $state<Tab | null>(null);
let activeHotkeyPicker = $state<{ card: Card, onSelect?: (code: string) => void } | null>(null);
let activeHotkeyConflict = $state<{ code: string, cards: Card[] } | null>(null);
let activeProgramPicker = $state<{ key: string, tab: Tab } | null>(null);
let activeIconPicker = $state<{ 
    current: string, 
    onSelect: (icon: string) => void,
    title?: string 
} | null>(null);

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
    get cardView() { return cardView; },
    get cardDensity() { return cardDensity; },
    get activeTabIndex() { return activeTabIndex; },
    get activeContextMenu() { return activeContextMenu; },
    get activeSettingsCard() { return activeSettingsCard; },
    get activeSettingsTab() { return activeSettingsTab; },
    get activeHotkeyPicker() { return activeHotkeyPicker; },
    get activeHotkeyConflict() { return activeHotkeyConflict; },
    get activeProgramPicker() { return activeProgramPicker; },
    get activeIconPicker() { return activeIconPicker; },
    
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
    startEditingCard,
    stopEditingCard,
};

// --- Action Implementations ---

function openIconPicker(current: string, onSelect: (icon: string) => void, title?: string): void {
    activeIconPicker = { current, onSelect, title };
}

function closeIconPicker(): void {
    activeIconPicker = null;
}

function openProgramPicker(key: string, tab: Tab): void {
    activeProgramPicker = { key, tab };
}

function closeProgramPicker(): void {
    activeProgramPicker = null;
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
    localStorage.setItem('hp_card_view', view);
}

function setCardDensity(density: 'expanded' | 'normal' | 'compact'): void {
    cardDensity = density;
    localStorage.setItem('hp_card_density', density);
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
    activeContextMenu = { x, y, card };
}

function closeContextMenu(): void {
    activeContextMenu = null;
}

function openSettings(card: Card): void {
    activeSettingsCard = card;
}

function closeSettings(): void {
    activeSettingsCard = null;
}

function openTabSettings(tab: Tab): void {
    activeSettingsTab = tab;
}

function closeTabSettings(): void {
    activeSettingsTab = null;
}

function openHotkeyPicker(card: Card, onSelect?: (code: string) => void): void {
    activeHotkeyPicker = { card, onSelect };
}

function closeHotkeyPicker(): void {
    activeHotkeyPicker = null;
}

function closeHotkeyConflict(): void {
    activeHotkeyConflict = null;
}

function setHotkeyConflict(code: string, cards: Card[]): void {
    activeHotkeyConflict = { code, cards };
}

function startEditingCard(card: Card): void {
    editingCardPath = card.filePath;
}

function stopEditingCard(): void {
    editingCardPath = '';
}
