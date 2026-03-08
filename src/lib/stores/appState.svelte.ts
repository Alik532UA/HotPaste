/**
 * Application State — Svelte 5 Runes-based global state.
 *
 * SSoT: all computed values use $derived, no manual sync.
 */

import type { Tab, Card, AppConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { BrowserFileSystemService, type IFileSystemService } from '../services/fileSystem';
import { isTabHotkey, isCardHotkey, TAB_HOTKEYS, QWERTY_KEYS } from '../utils/keyboardLayout';

// --- Singleton state using Svelte 5 Runes ---

/** The file system service instance */
const fileSystemService: IFileSystemService = new BrowserFileSystemService();

/** All tabs loaded from the directory */
let tabs = $state<Tab[]>([]);

/** Index of the currently active tab */
let activeTabIndex = $state(0);

/** Whether a directory is connected */
let isConnected = $state(false);

/** Root directory name */
let rootName = $state('');

/** Toast message to show */
let toastMessage = $state('');

/** Toast visibility flag */
let toastVisible = $state(false);

/** Toast timeout handle */
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

/** Global scale */
let scale = $state(1.0);

/** Whether a card is currently "flashing" (just copied) */
let flashingCardPath = $state('');

/** App mode: 'copy' or 'edit' */
let appMode = $state<'copy' | 'edit'>('copy');

/** Card view: 'short' (truncated) or 'full' (full text) */
let cardView = $state<'short' | 'full'>('short');

/** App config (persisted to localStorage) */
let config = $state<AppConfig>(loadConfig());

// --- Derived state ---

/** The currently active tab */
const activeTab = $derived(tabs[activeTabIndex] ?? null);

/** Cards in the active tab */
const activeCards = $derived(activeTab?.cards ?? []);

/** Total number of tabs */
const tabCount = $derived(tabs.length);

// --- State accessors (exported as getters for reactivity) ---

export function getState() {
    return {
        get tabs() { return tabs; },
        get activeTabIndex() { return activeTabIndex; },
        get activeTab() { return activeTab; },
        get activeCards() { return activeCards; },
        get tabCount() { return tabCount; },
        get isConnected() { return isConnected; },
        get rootName() { return rootName; },
        get toastMessage() { return toastMessage; },
        get toastVisible() { return toastVisible; },
        get scale() { return scale; },
        get flashingCardPath() { return flashingCardPath; },
        get appMode() { return appMode; },
        get cardView() { return cardView; },
        get config() { return config; },
    };
}

// --- Actions ---

/** Connect to a local directory */
export async function connectDirectory(): Promise<void> {
    const granted = await fileSystemService.requestAccess();
    if (!granted) return;

    isConnected = true;
    rootName = fileSystemService.getRootName();
    await refreshTabs();
}

/** Refresh tabs from the file system */
export async function refreshTabs(): Promise<void> {
    if (!fileSystemService.hasAccess()) return;

    tabs = await fileSystemService.readDirectory();
    activeTabIndex = 0;
}

/** Select a tab by index */
export function selectTab(index: number): void {
    if (index >= 0 && index < tabs.length) {
        activeTabIndex = index;
    }
}

/** Select a tab by hotkey */
export function selectTabByHotkey(key: string): boolean {
    if (!isTabHotkey(key)) return false;
    const index = TAB_HOTKEYS.indexOf(key);
    if (index >= 0 && index < tabs.length) {
        activeTabIndex = index;
        return true;
    }
    return false;
}

/** Copy a card's content by hotkey */
export async function copyCardByHotkey(key: string): Promise<boolean> {
    if (!isCardHotkey(key)) return false;
    const lowerKey = key.toLowerCase();
    const card = activeCards.find(c => c.hotkey === lowerKey);
    if (!card) return false;
    await copyCard(card);
    return true;
}

/** Copy a specific card's content to clipboard */
export async function copyCard(card: Card): Promise<void> {
    try {
        await navigator.clipboard.writeText(card.content);
        showFlash(card.filePath);
        showToast(`Скопійовано: ${card.name}`);
    } catch (err) {
        console.error('[HotPaste] Failed to copy:', err);
        showToast('Помилка копіювання!');
    }
}

/** Save a card's content (write to file) */
export async function saveCard(card: Card, newContent: string): Promise<void> {
    try {
        await fileSystemService.writeFile(card.filePath, newContent);
        // Update in-memory data
        card.content = newContent;
        showToast(`Збережено: ${card.name}`);
    } catch (err) {
        console.error('[HotPaste] Failed to save:', err);
        showToast('Помилка збереження!');
    }
}

/** Set global scale */
export function setScale(newScale: number): void {
    scale = Math.max(0.5, Math.min(2.0, newScale));
    config.scale = scale;
    saveConfig();
}

/** Adjust scale by delta */
export function adjustScale(delta: number): void {
    setScale(scale + delta);
}

/** Toggle app mode between copy and edit */
export function toggleAppMode(): void {
    appMode = appMode === 'copy' ? 'edit' : 'copy';
}

/** Set app mode explicitly */
export function setAppMode(mode: 'copy' | 'edit'): void {
    appMode = mode;
}

/** Toggle card view between short and full */
export function toggleCardView(): void {
    cardView = cardView === 'short' ? 'full' : 'short';
}

/** Set card view explicitly */
export function setCardView(view: 'short' | 'full'): void {
    cardView = view;
}

// --- Toast ---

function showToast(message: string): void {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage = message;
    toastVisible = true;
    toastTimeout = setTimeout(() => {
        toastVisible = false;
    }, 1500);
}

// --- Flash animation ---

function showFlash(cardPath: string): void {
    flashingCardPath = cardPath;
    setTimeout(() => {
        flashingCardPath = '';
    }, 400);
}

// --- Config persistence ---

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

// --- Keyboard handler ---

export function handleGlobalKeydown(event: KeyboardEvent): void {
    // Ignore if typing in an input/textarea
    const target = event.target as HTMLElement;
    if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
    ) {
        return;
    }

    // Ignore if modifier keys are pressed (except for Ctrl+scroll handled elsewhere)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (!isConnected) return;

    const key = event.key;

    // Tab switch (digits)
    if (selectTabByHotkey(key)) {
        event.preventDefault();
        return;
    }

    // Card copy (letters) — only in copy mode
    if (appMode === 'copy' && isCardHotkey(key)) {
        event.preventDefault();
        copyCardByHotkey(key);
        return;
    }
}
