/**
 * Application State — Svelte 5 Runes-based global state.
 *
 * SSoT: all computed values use $derived, no manual sync.
 */

import type { Tab, Card, AppConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { BrowserFileSystemService, type IFileSystemService } from '../services/fileSystem';
import { isTabHotkey, isCardHotkey, TAB_HOTKEYS, QWERTY_KEYS } from '../utils/keyboardLayout';
import { logService } from '../services/logService';

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

/** Debounce timer for saving _hotpaste.json */
let configSaveTimeout: ReturnType<typeof setTimeout> | null = null;

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
        // Filter out strikethrough lines
        const lines = card.content.split('\n');
        const activeLines = lines.filter((_, idx) => !card.strikethrough.includes(idx));
        const textToCopy = activeLines.join('\n');

        // If everything is strikethroughed, we might still copy empty string, which is fine
        await navigator.clipboard.writeText(textToCopy);
        showFlash(card.filePath);
        showToast(`Скопійовано: ${card.name}`);
        logService.log('appState', `Скопійовано картку: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to copy card', err);
        showToast('Помилка копіювання!');
    }
}

/** Save a card's content (write to file). If it's a mock new card, creates it first. */
export async function saveCard(card: Card, newContent: string): Promise<void> {
    try {
        let isNewCard = false;

        // Check if this is a newly created mock card that hasn't been saved yet
        if (!card.filePath) {
            isNewCard = true;
            const tab = activeTab;
            if (!tab) throw new Error("No active tab to save to.");

            // Generate a filename based on timestamp or just new_snippet
            const date = new Date();
            const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
            const fileName = `snippet_${timestamp}.txt`;

            // Compute the new file path correctly. Assuming tab.path is the directory path.
            // Replace backslashes just in case we are mixing separators
            const separator = tab.path.includes('\\') ? '\\' : '/';
            // ensure tab.path does not end with separator
            const basePath = tab.path.replace(/[\\/]$/, '');
            card.filePath = `${basePath}${separator}${fileName}`;
            card.fileName = fileName;
            card.name = fileName.replace(/\.[^/.]+$/, ""); // name without extension
        }

        await fileSystemService.writeFile(card.filePath, newContent);

        // Recalculate strikethrough indices if content changed and card is not new
        if (!isNewCard && card.strikethrough.length > 0) {
            const oldLines = card.content.split('\n');
            const newLines = newContent.split('\n');

            // Simple approach: keep strikethroughs for lines that exactly match
            // A more complex diff algorithm could be used, but this is safer for now
            const newStrikethrough: number[] = [];
            for (const oldIdx of card.strikethrough) {
                if (oldIdx < oldLines.length) {
                    const lineText = oldLines[oldIdx];
                    // Find where this line went in the new text
                    const newIdx = newLines.indexOf(lineText);
                    if (newIdx !== -1 && !newStrikethrough.includes(newIdx)) {
                        newStrikethrough.push(newIdx);
                    }
                }
            }
            card.strikethrough = newStrikethrough.sort((a, b) => a - b);
            debouncedSaveTabConfig();
        }

        // Update in-memory data
        card.content = newContent;

        // If it was a mock new card, we need to fully refresh tabs to get the real file handle
        // and order applied. For now, we just refresh tabs entirely.
        if (isNewCard) {
            await refreshTabs();
        }

        showToast(`Збережено: ${card.name}`);
        logService.log('appState', `Збережено картку: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to save card', err);
        showToast('Помилка збереження!');
    }
}

/** Create a new mock card and append it to the active cards to start editing */
export function startNewCardCreation(): void {
    const tab = activeTab;
    if (!tab) return;

    // Create a mock card that does not have a real filePath yet
    const mockCard: Card = {
        name: "New Snippet",
        fileName: "",
        filePath: "",
        content: "",
        extension: "txt",
        contentLower: "",
        // Derived configs
        displayName: null,
        hotkey: null,
        icon: null,
        color: null,
        borderColor: null,
        strikethrough: [],
        // Temporary flag indicating it's new
        isNewMock: true
    } as any; // Type hack for the temporary flag

    // Prepend to active cards temporarily (we actually modify the reactive array)
    tab.cards = [mockCard, ...tab.cards];
}

/** Toggle strikethrough state for a specific line in a card */
export function toggleStrikethrough(card: Card, lineIndex: number): void {
    const sIdx = card.strikethrough.indexOf(lineIndex);
    if (sIdx === -1) {
        card.strikethrough.push(lineIndex);
        card.strikethrough.sort((a, b) => a - b);
    } else {
        card.strikethrough.splice(sIdx, 1);
    }

    // We mutated the object property directly, but Vue/Svelte 5 runes handle deep reactivity 
    // if the object is within a $state array.
    debouncedSaveTabConfig();
}

/** Debounced saving of the current tab's _hotpaste.json */
function debouncedSaveTabConfig() {
    if (configSaveTimeout) clearTimeout(configSaveTimeout);
    configSaveTimeout = setTimeout(() => {
        saveCurrentTabConfig();
    }, 500);
}

/** Builds and saves config for the active tab */
async function saveCurrentTabConfig() {
    const tab = activeTab;
    if (!tab) return;

    try {
        // Read existing first to not overwrite tab-level settings
        let existingConfig = await fileSystemService.readConfig(tab.path);

        if (!existingConfig.cards) {
            existingConfig.cards = {};
        }

        // Update card configurations
        for (const card of tab.cards) {
            if (!existingConfig.cards[card.fileName]) {
                existingConfig.cards[card.fileName] = {};
            }

            // Only save what's different from default/derived
            const cInfo = existingConfig.cards[card.fileName];

            // Strikethrough
            if (card.strikethrough && card.strikethrough.length > 0) {
                cInfo.strikethrough = [...card.strikethrough];
            } else {
                delete cInfo.strikethrough;
            }
        }

        await fileSystemService.writeConfig(tab.path, existingConfig);
        logService.log('appState', `Збережено конфіг для вкладки: ${tab.path}`);
    } catch (err) {
        logService.log('error', 'Failed to save tab config', err);
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

    // Only check hotkeys if we are connected
    if (!isConnected) return;

    // Ctrl+N = New Card
    if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        startNewCardCreation();
        return;
    }

    // Ignore if modifier keys are pressed (except for Ctrl+scroll handled elsewhere)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;

    // Tab switch (digits)
    if (selectTabByHotkey(key)) {
        event.preventDefault();
        return;
    }

    // Card copy (letters)
    if (isCardHotkey(key)) {
        event.preventDefault();
        copyCardByHotkey(key);
        return;
    }
}
