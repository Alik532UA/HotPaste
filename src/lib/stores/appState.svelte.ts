/**
 * Application State — Svelte 5 Runes-based global state.
 *
 * SSoT: all computed values use $derived, no manual sync.
 */

import type { Tab, Card, AppConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { BrowserFileSystemService, type IFileSystemService } from '../services/fileSystem';
import { isTabHotkey, isCardHotkey, TAB_CODES, getHotkeyLabel } from '../utils/keyboardLayout';
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

/** Context menu state */
let activeContextMenu = $state<{ x: number, y: number, card: Card } | null>(null);

/** Settings modal state */
let activeSettingsCard = $state<Card | null>(null);
let activeSettingsTab = $state<Tab | null>(null);

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
        get activeContextMenu() { return activeContextMenu; },
        get activeSettingsCard() { return activeSettingsCard; },
        get activeSettingsTab() { return activeSettingsTab; },
        getHotkeyLabel: (code: string) => getHotkeyLabel(code),
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

    logService.log('appState', 'Refreshing tabs from disk...');
    const oldActivePath = activeTab?.path;
    const loadedTabs = await fileSystemService.readDirectory();

    // Reconcile metadata for each tab before assigning to state
    for (const tab of loadedTabs) {
        await reconcileTabMetadata(tab);
    }

    tabs = loadedTabs;
    logService.log('appState', `Tabs loaded: ${tabs.length}. Restoring active path: ${oldActivePath}`);

    // Try to restore active tab by path
    if (oldActivePath) {
        const index = tabs.findIndex(t => t.path === oldActivePath);
        if (index !== -1) {
            activeTabIndex = index;
        } else {
            activeTabIndex = Math.min(activeTabIndex, tabs.length - 1);
        }
    } else {
        activeTabIndex = 0;
    }
}

/** 
 * Automatically matches metadata in _hotpaste.json with files on disk 
 * if they were renamed manually (based on size + mtime fingerprint).
 */
async function reconcileTabMetadata(tab: Tab): Promise<void> {
    try {
        const config = await fileSystemService.readConfig(tab.path);
        if (!config.cards || Object.keys(config.cards).length === 0) return;

        const diskFileNames = new Set(tab.cards.map(c => c.fileName));
        const configKeys = Object.keys(config.cards);
        
        // 1. Identify "orphaned" metadata (in JSON but not on disk)
        const orphanedKeys = configKeys.filter(k => !diskFileNames.has(k));
        if (orphanedKeys.length === 0) return;

        // 2. Identify "unrecognized" files (on disk but not in JSON)
        const unrecognizedCards = tab.cards.filter(c => !config.cards![c.fileName]);
        
        let modified = false;

        for (const orphanKey of orphanedKeys) {
            const orphanConfig = config.cards[orphanKey];
            if (!orphanConfig.fingerprint) continue;

            // Try Level 1 Match: Size + Date
            let match = unrecognizedCards.find(c => 
                c.size === orphanConfig.fingerprint?.size && 
                c.lastModified === orphanConfig.fingerprint?.lastModified
            );

            // Try Level 2 Match: Date only (if user edited some lines but timestamp is same, 
            // or if we decide to trust Date more on some OS)
            if (!match) {
                match = unrecognizedCards.find(c => 
                    c.lastModified === orphanConfig.fingerprint?.lastModified
                );
            }

            if (match) {
                logService.log('appState', `Відновлено зв'язок для перейменованого файлу: ${orphanKey} -> ${match.fileName}`);
                
                // Transfer metadata to new key
                config.cards[match.fileName] = { ...orphanConfig };
                delete config.cards[orphanKey];
                
                // Update the runtime card object
                match.displayName = orphanConfig.displayName || null;
                match.icon = orphanConfig.icon || null;
                match.color = orphanConfig.color || null;
                match.borderColor = orphanConfig.borderColor || null;
                match.strikethrough = orphanConfig.strikethrough || [];
                match.name = match.displayName || match.fileName.replace(/\.[^/.]+$/, "");
                match.hotkey = orphanConfig.hotkey || '';

                modified = true;
                unrecognizedCards.splice(unrecognizedCards.indexOf(match), 1);
            } else {
                // If NO match found, create a "Ghost Card" representing this missing file
                const ghostCard: Card = {
                    id: tab.path === '__root__' ? orphanKey : `${tab.path}/${orphanKey}`,
                    name: orphanConfig.displayName || orphanKey.replace(/\.[^/.]+$/, ""),
                    displayName: orphanConfig.displayName || null,
                    fileName: orphanKey,
                    filePath: tab.path === '__root__' ? orphanKey : `${tab.path}/${orphanKey}`,
                    content: "ФАЙЛ НЕ ЗНАЙДЕНО",
                    extension: orphanKey.split('.').pop() || 'txt',
                    hotkey: orphanConfig.hotkey || '',
                    icon: orphanConfig.icon || 'AlertTriangle',
                    color: orphanConfig.color || null,
                    borderColor: orphanConfig.borderColor || '#ff4b4b',
                    strikethrough: orphanConfig.strikethrough || [],
                    size: 0,
                    lastModified: 0,
                    isMissing: true
                };
                
                // Put ghost cards at the beginning or according to order
                tab.cards.push(ghostCard);
            }
        }

        // Sort tab cards again to respect order even with ghosts
        const orderArr = config.tab?.order || [];
        tab.cards.sort((a, b) => {
            const indexA = orderArr.indexOf(a.fileName);
            const indexB = orderArr.indexOf(b.fileName);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.fileName.localeCompare(b.fileName);
        });

        if (modified) {
            await fileSystemService.writeConfig(tab.path, config);
        }
    } catch (err) {
        logService.log('error', 'Metadata reconciliation failed', err);
    }
}

/** Action to remove metadata for a file that is no longer needed */
export async function removeOrphanedConfig(card: Card): Promise<void> {
    try {
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        
        const config = await fileSystemService.readConfig(tabPath);
        if (config.cards && config.cards[card.fileName]) {
            delete config.cards[card.fileName];
            
            if (config.tab?.order) {
                config.tab.order = config.tab.order.filter(n => n !== card.fileName);
            }
            
            await fileSystemService.writeConfig(tabPath, config);
        }
        
        await refreshTabs();
        showToast("Видалено з конфігурації");
    } catch (err) {
        logService.log('error', 'Failed to remove orphaned config', err);
    }
}

/** Action to manually link a missing card to an existing unrecognized file */
export async function linkFileManually(ghostCard: Card, realFileName: string): Promise<void> {
    try {
        const parts = ghostCard.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        
        const config = await fileSystemService.readConfig(tabPath);
        if (config.cards && config.cards[ghostCard.fileName]) {
            const metadata = { ...config.cards[ghostCard.fileName] };
            delete config.cards[ghostCard.fileName];
            
            config.cards[realFileName] = metadata;
            
            if (config.tab?.order) {
                config.tab.order = config.tab.order.map(n => n === ghostCard.fileName ? realFileName : n);
            }
            
            await fileSystemService.writeConfig(tabPath, config);
        }
        
        await refreshTabs();
        showToast("Зв'язок відновлено");
    } catch (err) {
        logService.log('error', 'Failed to link file manually', err);
    }
}

/** Physical file rename action */
export async function renamePhysicalFile(card: Card, newFileName: string): Promise<void> {
    if (!newFileName || newFileName === card.fileName) return;
    
    // Ensure extension is preserved or added if missing
    if (!newFileName.includes('.')) {
        newFileName += card.extension;
    }

    try {
        const oldFileName = card.fileName;
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';

        // 1. Physical rename
        await fileSystemService.renameFile(card.filePath, newFileName);

        // 2. Update config JSON keys
        const config = await fileSystemService.readConfig(tabPath);
        if (config.cards && config.cards[oldFileName]) {
            config.cards[newFileName] = { ...config.cards[oldFileName] };
            delete config.cards[oldFileName];
            
            // Update order array if exists
            if (config.tab?.order) {
                config.tab.order = config.tab.order.map(n => n === oldFileName ? newFileName : n);
            }
            
            await fileSystemService.writeConfig(tabPath, config);
        }

        await refreshTabs();
        showToast(`Файл перейменовано на ${newFileName}`);
    } catch (err) {
        logService.log('error', 'Failed to rename file', err);
        showToast('Помилка перейменування файлу!');
    }
}

/** Select a tab by index */
export function selectTab(index: number): void {
    if (index >= 0 && index < tabs.length) {
        activeTabIndex = index;
    }
}

/** Select a tab by hotkey (physical code) */
export function selectTabByHotkey(code: string): boolean {
    if (!isTabHotkey(code)) return false;
    const index = TAB_CODES.indexOf(code);
    if (index >= 0 && index < tabs.length) {
        activeTabIndex = index;
        return true;
    }
    return false;
}

/** Copy a card's content by hotkey (physical code) */
export async function copyCardByHotkey(code: string): Promise<boolean> {
    const card = activeCards.find(c => c.hotkey === code);
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
    logService.log('appState', `saveCard called for: ${card.name}, id: ${card.id}, isNewMock: ${card.isNewMock}`);
    try {
        let isNewCard = false;

        // Check if this is a newly created mock card that hasn't been saved yet
        if (card.isNewMock || !card.filePath || card.filePath.startsWith('new-')) {
            isNewCard = true;
            const tab = activeTab;
            if (!tab) throw new Error("No active tab to save to.");

            // Generate filename from content: first 2-3 words
            const rawWords = newContent.trim().split(/\s+/).slice(0, 3);
            const cleanWords = rawWords
                .map(w => w.replace(/[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ]/g, ''))
                .filter(w => w.length > 0);
            
            logService.log('appState', `Generating name from content. Words: ${JSON.stringify(rawWords)}, Clean: ${JSON.stringify(cleanWords)}`);
            
            let fileName = cleanWords.join('_');
            if (fileName.length > 30) fileName = fileName.substring(0, 30); // Limit length
            fileName += '.txt';
            
            if (fileName === '.txt' || cleanWords.length === 0) {
                const date = new Date();
                const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
                fileName = `snippet_${timestamp}.txt`;
                logService.log('appState', `Fallback to timestamp filename: ${fileName}`);
            }

            if (tab.path === '__root__') {
                card.filePath = `__root__/${fileName}`;
            } else {
                card.filePath = `${tab.path}/${fileName}`;
            }
            card.fileName = fileName;
            card.displayName = null;
            card.name = fileName.replace(/\.[^/.]+$/, "");
            logService.log('appState', `Mock card promoted to real file: ${card.filePath}`);
        }

        await fileSystemService.writeFile(card.filePath, newContent);
        logService.log('appState', `File written successfully: ${card.filePath}`);

        // Update in-memory data immediately
        card.content = newContent;
        if (card.isNewMock) {
            delete card.isNewMock;
            // IMPORTANT: We do NOT change card.id here to keep Svelte component stable 
            // until the full refresh replaces it.
        }

        if (isNewCard) {
            logService.log('appState', 'Triggering refreshTabs (background)');
            // FIRE AND FORGET refresh, don't await!
            refreshTabs(); 
        }

        showToast(`Збережено: ${card.name}`);
        logService.log('appState', `Збережено картку: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to save card', err);
        showToast('Помилка збереження!');
        throw err;
    }
}

/** Duplicate a card */
export async function duplicateCard(card: Card): Promise<void> {
    try {
        const ext = card.extension;
        const nameWithoutExt = card.fileName.slice(0, -ext.length);
        const newFileName = `${nameWithoutExt}_copy${ext}`;

        await fileSystemService.copyFile(card.filePath, newFileName);

        // Copy config if exists
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        const config = await fileSystemService.readConfig(tabPath);

        if (config.cards && config.cards[card.fileName]) {
            config.cards[newFileName] = JSON.parse(JSON.stringify(config.cards[card.fileName]));
            await fileSystemService.writeConfig(tabPath, config);
        }

        await refreshTabs();
        showToast(`Дубльовано: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to duplicate card', err);
        showToast('Помилка дублювання!');
    }
}

/** Delete a card */
export async function deleteCard(card: Card): Promise<void> {
    if (!confirm(`Ви впевнені, що хочете видалити сніпет "${card.name}"?`)) return;

    try {
        await fileSystemService.deleteFile(card.filePath);

        // Remove from config if exists
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        const config = await fileSystemService.readConfig(tabPath);

        if (config.cards && config.cards[card.fileName]) {
            delete config.cards[card.fileName];
            // Also remove from order
            if (config.tab?.order) {
                config.tab.order = config.tab.order.filter(n => n !== card.fileName);
            }
            await fileSystemService.writeConfig(tabPath, config);
        }

        await refreshTabs();
        showToast(`Видалено: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to delete card', err);
        showToast('Помилка видалення!');
    }
}

/** Move card to another tab */
export async function moveCardToTab(card: Card, targetTabPath: string): Promise<void> {
    try {
        await fileSystemService.moveFile(card.filePath, targetTabPath);

        // Optional: move config too? For now simple move.
        await refreshTabs();
        showToast(`Переміщено в іншу вкладку`);
    } catch (err) {
        logService.log('error', 'Failed to move card', err);
        showToast('Помилка переміщення!');
    }
}

/** Create a new mock card and append it to the active cards to start editing */
export function startNewCardCreation(): void {
    const tab = activeTab;
    if (!tab) return;

    const tempId = `new-${Date.now()}`;
    logService.log('appState', `startNewCardCreation: generated tempId ${tempId}`);

    // Create a mock card that does not have a real filePath yet
    const mockCard: Card = {
        id: tempId, // Unique stable key for Svelte grid
        name: "New Snippet",
        fileName: "",
        filePath: tempId, 
        content: "",
        extension: "txt",
        // Derived configs
        displayName: null,
        hotkey: '',
        icon: null,
        color: null,
        borderColor: null,
        strikethrough: [],
        size: 0,
        lastModified: 0,
        // Temporary flag indicating it's new
        isNewMock: true
    };

    // Prepend to active cards temporarily (we actually modify the reactive array)
    tab.cards = [mockCard, ...tab.cards];
    logService.log('appState', 'New mock card added to tab.cards');
}

/** Context Menu actions */
export function openContextMenu(x: number, y: number, card: Card): void {
    activeContextMenu = { x, y, card };
}

export function closeContextMenu(): void {
    activeContextMenu = null;
}

/** Settings modal actions */
export function openSettings(card: Card): void {
    activeSettingsCard = card;
}

export function closeSettings(): void {
    activeSettingsCard = null;
}

/** Update card settings and save */
export async function updateCardSettings(card: Card, settings: Partial<Card>): Promise<void> {
    // Update in memory
    Object.assign(card, settings);

    // If displayName was set to empty, use null for config
    if (settings.displayName === "") card.displayName = null;

    // Sync UI name
    card.name = card.displayName || card.fileName.replace(/\.[^/.]+$/, "");

    await saveCurrentTabConfig();
    showToast(`Налаштування збережено: ${card.name}`);
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
export function debouncedSaveTabConfig() {
    if (configSaveTimeout) clearTimeout(configSaveTimeout);
    configSaveTimeout = setTimeout(() => {
        saveCurrentTabConfig();
    }, 500);
}

/** Move a card to a new position (DND) */
export function moveCard(fromIndex: number, toIndex: number): void {
    const tab = activeTab;
    if (!tab) return;

    if (fromIndex < 0 || fromIndex >= tab.cards.length || toIndex < 0 || toIndex >= tab.cards.length) {
        return;
    }

    const cardToMove = tab.cards[fromIndex];
    tab.cards.splice(fromIndex, 1);
    tab.cards.splice(toIndex, 0, cardToMove);

    debouncedSaveTabConfig();
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

        if (!existingConfig.tab) {
            existingConfig.tab = {};
        }

        // Save order
        existingConfig.tab.order = tab.cards.map(c => c.fileName);

        // Update card configurations
        for (const card of tab.cards) {
            if (!existingConfig.cards[card.fileName]) {
                existingConfig.cards[card.fileName] = {};
            }

            const cInfo = existingConfig.cards[card.fileName];

            // Customization fields
            if (card.displayName) cInfo.displayName = card.displayName; else delete cInfo.displayName;
            if (card.hotkey) cInfo.hotkey = card.hotkey; else delete cInfo.hotkey;
            if (card.icon) cInfo.icon = card.icon; else delete cInfo.icon;
            if (card.color) cInfo.color = card.color; else delete cInfo.color;
            if (card.borderColor) cInfo.borderColor = card.borderColor; else delete cInfo.borderColor;

            // System fingerprint for recovery
            cInfo.fingerprint = {
                size: card.size,
                lastModified: card.lastModified
            };

            // Strikethrough
            if (card.strikethrough && card.strikethrough.length > 0) {
                cInfo.strikethrough = [...card.strikethrough];
            } else {
                delete cInfo.strikethrough;
            }

            // Cleanup empty card objects
            if (Object.keys(cInfo).length === 0) {
                delete existingConfig.cards[card.fileName];
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

/** Create a new tab (physical directory) */
export async function createNewTab(name: string): Promise<void> {
    try {
        await fileSystemService.createDirectory(name);
        await refreshTabs();
        showToast(`Вкладку "${name}" створено`);
    } catch (err) {
        logService.log('error', 'Failed to create tab', err);
        showToast('Помилка створення вкладки!');
    }
}

/** Delete a tab (physical directory) */
export async function deleteTab(tab: Tab): Promise<void> {
    if (tab.path === '__root__') {
        showToast('Неможливо видалити кореневу вкладку');
        return;
    }
    if (!confirm(`Ви впевнені, що хочете видалити вкладку "${tab.name}" з усіма файлами?`)) return;

    try {
        await fileSystemService.deleteDirectory(tab.path);
        
        // Remove from root config tabOrder if exists
        const rootConfig = await fileSystemService.readConfig('__root__');
        if (rootConfig.tab?.tabOrder) {
            rootConfig.tab.tabOrder = rootConfig.tab.tabOrder.filter(p => p !== tab.path);
            if (rootConfig.tabs) delete rootConfig.tabs[tab.path];
            await fileSystemService.writeConfig('__root__', rootConfig);
        }

        await refreshTabs();
        showToast(`Вкладку "${tab.name}" видалено`);
    } catch (err) {
        logService.log('error', 'Failed to delete tab', err);
        showToast('Помилка видалення вкладки!');
    }
}

/** Physical tab rename (rename directory) */
export async function renamePhysicalTab(tab: Tab, newDirName: string): Promise<void> {
    if (!newDirName || newDirName === tab.path || tab.path === '__root__') return;

    try {
        const oldPath = tab.path;
        await fileSystemService.renameDirectory(oldPath, newDirName);

        // Update root config tabOrder
        const rootConfig = await fileSystemService.readConfig('__root__');
        if (rootConfig.tab?.tabOrder) {
            rootConfig.tab.tabOrder = rootConfig.tab.tabOrder.map(p => p === oldPath ? newDirName : p);
        }
        if (rootConfig.tabs && rootConfig.tabs[oldPath]) {
            rootConfig.tabs[newDirName] = { ...rootConfig.tabs[oldPath] };
            delete rootConfig.tabs[oldPath];
        }
        await fileSystemService.writeConfig('__root__', rootConfig);

        await refreshTabs();
        showToast(`Вкладку перейменовано на ${newDirName}`);
    } catch (err) {
        logService.log('error', 'Failed to rename tab directory', err);
        showToast('Помилка перейменування папки!');
    }
}

/** Update tab settings (displayName, icon, color) and save to root config */
export async function updateTabSettings(tab: Tab, settings: Partial<Tab>): Promise<void> {
    // 1. Update in-memory tab object
    Object.assign(tab, settings);
    if (settings.displayName === "") tab.displayName = null;
    
    // Sync UI name
    tab.name = tab.displayName || (tab.path === '__root__' ? '📄 Файли' : tab.path);

    // 2. Save to ROOT config (since tabs metadata is stored in root's _hotpaste.json)
    try {
        const rootConfig = await fileSystemService.readConfig('__root__');
        
        if (tab.path === '__root__') {
            // Root tab metadata is stored in "tab" property of root config
            if (!rootConfig.tab) rootConfig.tab = {};
            rootConfig.tab.displayName = tab.displayName;
            rootConfig.tab.icon = tab.icon;
            rootConfig.tab.color = tab.color;
        } else {
            // Other tabs metadata is stored in "tabs" dictionary of root config
            if (!rootConfig.tabs) rootConfig.tabs = {};
            if (!rootConfig.tabs[tab.path]) rootConfig.tabs[tab.path] = {};
            
            const tMeta = rootConfig.tabs[tab.path];
            tMeta.displayName = tab.displayName;
            tMeta.icon = tab.icon;
            tMeta.color = tab.color;
            
            // Cleanup empty
            if (Object.keys(tMeta).length === 0) delete rootConfig.tabs[tab.path];
        }
        
        await fileSystemService.writeConfig('__root__', rootConfig);
        showToast(`Налаштування вкладки збережено`);
    } catch (err) {
        logService.log('error', 'Failed to save tab settings', err);
    }
}

/** Open tab settings modal */
export function openTabSettings(tab: Tab): void {
    activeSettingsTab = tab;
}

export function closeTabSettings(): void {
    activeSettingsTab = null;
}

/** Duplicate a tab */
export async function duplicateTab(tab: Tab): Promise<void> {
    if (tab.path === '__root__') return;
    
    try {
        const newPath = `${tab.path}_copy`;
        await fileSystemService.createDirectory(newPath);
        
        // Copy all files
        for (const card of tab.cards) {
            await fileSystemService.copyFile(card.filePath, `${newPath}/${card.fileName}`);
        }
        
        // Copy config if exists
        const config = await fileSystemService.readConfig(tab.path);
        await fileSystemService.writeConfig(newPath, config);
        
        await refreshTabs();
        showToast(`Вкладку дубльовано: ${newPath}`);
    } catch (err) {
        logService.log('error', 'Failed to duplicate tab', err);
        showToast('Помилка дублювання вкладки!');
    }
}

/** Move a tab to a new position (DnD) */
export async function moveTab(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex < 0 || fromIndex >= tabs.length || toIndex < 0 || toIndex >= tabs.length) return;

    // Move in memory
    const movedTab = tabs[fromIndex];
    tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, movedTab);

    // Save order to root config
    try {
        const rootConfig = await fileSystemService.readConfig('__root__');
        if (!rootConfig.tab) rootConfig.tab = {};
        
        // Exclude __root__ from tabOrder as it's always first or handled specially
        rootConfig.tab.tabOrder = tabs
            .filter(t => t.path !== '__root__')
            .map(t => t.path);
            
        await fileSystemService.writeConfig('__root__', rootConfig);
    } catch (err) {
        logService.log('error', 'Failed to save tab order', err);
    }
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
    if (event.ctrlKey && event.code === 'KeyN') {
        event.preventDefault();
        startNewCardCreation();
        return;
    }

    // Ignore if modifier keys are pressed (except for Ctrl+scroll handled elsewhere)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const code = event.code;

    // Tab switch (Digit1-0)
    if (selectTabByHotkey(code)) {
        event.preventDefault();
        return;
    }

    // Card copy (Keys)
    if (isCardHotkey(code)) {
        // We only want to prevent default and try to copy if a card actually has this hotkey
        copyCardByHotkey(code).then(success => {
            if (success) {
                // Potential issue: event is already processed by the time promise resolves
                // But in most cases it's fine for simple preventing
            }
        });
        
        // To be safe, always prevent if it's a valid card hotkey area
        event.preventDefault();
    }
}
