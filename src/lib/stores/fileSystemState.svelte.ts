/**
 * File System State — Manages directories, files, tabs, and metadata reconciliation.
 */

import type { Tab, Card, HotPasteConfig, TabType } from '../types';
import { createFileSystemService, type IFileSystemService } from '../services/fileSystem';
import { logService } from '../services/logService.svelte';
import { uiState } from './uiState.svelte';
import { hotkeyState } from './hotkeyState.svelte';
import { HotPasteConfigSchema } from '../schemas/config';
import { QWERTY_CODES } from '../utils/keyboardLayout';

// --- Singleton state ---

let _fileSystemService: IFileSystemService | null = null;
function getFSService() {
    if (!_fileSystemService) {
        _fileSystemService = createFileSystemService();
    }
    return _fileSystemService;
}

let tabs = $state<Tab[]>([]);
let isConnected = $state(false);
let rootName = $state('');
let configSaveTimeout: ReturnType<typeof setTimeout> | null = null;

// --- Getters ---

export const fsState = {
    get tabs() { return tabs; },
    get isConnected() { return isConnected; },
    get rootName() { return rootName; },
    get activeTab() { return tabs[uiState.activeTabIndex] ?? null; },
    get activeCards() { return this.activeTab?.cards ?? []; },
    
    // Actions
    connectDirectory,
    connectDefaultProject,
    refreshTabs,
    saveCard,
    deleteCard,
    duplicateCard,
    moveCardToTab,
    moveCard,
    moveCardRelative,
    renamePhysicalFile,
    createNewTab,
    deleteTab,
    renamePhysicalTab,
    updateTabSettings,
    updateTabAssignment,
    duplicateTab,
    moveTab,
    toggleStrikethrough,
    saveCurrentTabConfig,
    saveTabOrder,
    startNewCardCreation,
    removeOrphanedConfig,
    linkFileManually,
    updateCardHotkey,
    resetCardHotkeyToDefault,
    resolveHotkeyConflict,
    updateCardSettings,
    copyCard,
};

// --- Implementations ---

async function connectDirectory(): Promise<void> {
    const granted = await getFSService().requestAccess();
    if (!granted) return;

    isConnected = true;
    rootName = getFSService().getRootName();
    await refreshTabs();
}

async function connectDefaultProject(): Promise<void> {
    const success = await getFSService().setProjectRoot('default-project');
    if (!success) return;

    isConnected = true;
    rootName = getFSService().getRootName() + '/default-project';
    await refreshTabs();
}

async function refreshTabs(): Promise<void> {
    if (!getFSService().hasAccess()) return;

    logService.info('fsState', 'Refreshing tabs from disk...');
    const oldActivePath = fsState.activeTab?.path;
    const oldActiveIndex = uiState.activeTabIndex;
    logService.info('fsState', `refreshTabs: oldActivePath=${oldActivePath}, oldActiveIndex=${oldActiveIndex}`);

    const loadedTabs = await getFSService().readDirectory();

    for (const tab of loadedTabs) {
        await reconcileTabMetadata(tab);
        autoAssignHotkeys(tab);
    }

    tabs = loadedTabs;

    // Update global hotkey map for the active tab
    hotkeyState.updateKeyMap(fsState.activeCards);

    if (oldActivePath) {
        const index = tabs.findIndex(t => t.path === oldActivePath);
        logService.info('fsState', `refreshTabs: found oldActivePath at index=${index}`);
        if (index !== -1) {
            uiState.selectTab(index, tabs.length, tabs[index].type);
        } else {
            const safeIdx = Math.min(oldActiveIndex, tabs.length - 1);
            logService.info('fsState', `refreshTabs: old path not found, using safeIdx=${safeIdx}`);
            uiState.selectTab(safeIdx, tabs.length, tabs[safeIdx]?.type);
        }
    } else {
        logService.info('fsState', `refreshTabs: no oldActivePath, selecting 0`);
        uiState.selectTab(0, tabs.length, tabs[0]?.type);
    }
}

async function reconcileTabMetadata(tab: Tab): Promise<void> {
    try {
        const config = await getFSService().readConfig(tab.path);
        if (!config.cards || Object.keys(config.cards).length === 0) return;

        const diskFileNames = new Set(tab.cards.map(c => c.fileName));
        const configKeys = Object.keys(config.cards);
        const orphanedKeys = configKeys.filter(k => !diskFileNames.has(k));
        if (orphanedKeys.length === 0) return;

        const unrecognizedCards = tab.cards.filter(c => !config.cards![c.fileName]);
        let modified = false;

        for (const orphanKey of orphanedKeys) {
            const orphanConfig = config.cards[orphanKey];
            if (!orphanConfig.fingerprint) continue;

            let match = unrecognizedCards.find(c => 
                c.size === orphanConfig.fingerprint?.size && 
                c.lastModified === orphanConfig.fingerprint?.lastModified
            );

            if (!match) {
                match = unrecognizedCards.find(c => 
                    c.lastModified === orphanConfig.fingerprint?.lastModified
                );
            }

            if (match) {
                config.cards[match.fileName] = { ...orphanConfig };
                delete config.cards[orphanKey];
                
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
                tab.cards.push(ghostCard);
            }
        }

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
            await getFSService().writeConfig(tab.path, config);
        }
    } catch (err) {
        logService.log('error', 'Metadata reconciliation failed', err);
    }
}

async function saveCurrentTabConfig() {
    const tab = fsState.activeTab;
    if (!tab) return;

    try {
        let existingConfig = await getFSService().readConfig(tab.path);
        if (!existingConfig.cards) existingConfig.cards = {};
        if (!existingConfig.tab) existingConfig.tab = {};

        existingConfig.tab.order = tab.cards.map(c => c.fileName);

        for (const card of tab.cards) {
            if (!existingConfig.cards[card.fileName]) {
                existingConfig.cards[card.fileName] = {};
            }
            const cInfo = existingConfig.cards[card.fileName];
            if (card.displayName) cInfo.displayName = card.displayName; else delete cInfo.displayName;
            if (card.isCustomHotkey) cInfo.hotkey = card.hotkey; else delete cInfo.hotkey;
            if (card.icon) cInfo.icon = card.icon; else delete cInfo.icon;
            if (card.color) cInfo.color = card.color; else delete cInfo.color;
            if (card.borderColor) cInfo.borderColor = card.borderColor; else delete cInfo.borderColor;
            cInfo.fingerprint = { size: card.size, lastModified: card.lastModified };
            if (card.strikethrough?.length > 0) cInfo.strikethrough = [...card.strikethrough]; else delete cInfo.strikethrough;
            if (Object.keys(cInfo).length === 0) delete existingConfig.cards[card.fileName];
        }

        await getFSService().writeConfig(tab.path, existingConfig);
    } catch (err) {
        logService.log('error', 'Failed to save tab config', err);
    }
}

function debouncedSaveTabConfig() {
    if (configSaveTimeout) clearTimeout(configSaveTimeout);
    configSaveTimeout = setTimeout(() => saveCurrentTabConfig(), 500);
}

async function saveCard(card: Card, newContent: string): Promise<void> {
    try {
        let isNewCard = false;
        if (card.isNewMock || !card.filePath || card.filePath.startsWith('new-')) {
            isNewCard = true;
            const tab = fsState.activeTab;
            if (!tab) throw new Error("No active tab");

            const rawWords = newContent.trim().split(/\s+/).slice(0, 3);
            const cleanWords = rawWords.map(w => w.replace(/[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ]/g, '')).filter(w => w.length > 0);
            let fileName = cleanWords.join('_') || `snippet_${Date.now()}`;
            if (fileName.length > 30) fileName = fileName.substring(0, 30);

            const existingFileNames = new Set(tab.cards.map(c => c.fileName.toLowerCase()));
            let finalFileName = `${fileName}.txt`;
            let version = 1;
            while (existingFileNames.has(finalFileName.toLowerCase())) {
                version++;
                finalFileName = `${fileName}_v${version}.txt`;
            }
            fileName = finalFileName;

            card.filePath = tab.path === '__root__' ? `__root__/${fileName}` : `${tab.path}/${fileName}`;
            card.fileName = fileName;
            card.displayName = null;
            card.name = fileName.replace(/\.[^/.]+$/, "");
        }

        await getFSService().writeFile(card.filePath, newContent);
        card.content = newContent;
        if (card.isNewMock) delete card.isNewMock;

        if (isNewCard) refreshTabs();
        uiState.showToast(`Збережено: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to save card', err);
        uiState.showToast('Помилка збереження!');
        throw err;
    }
}

async function deleteCard(card: Card): Promise<void> {
    if (!confirm(`Ви впевнені, що хочете видалити сніпет "${card.name}"?`)) return;
    try {
        await getFSService().deleteFile(card.filePath);
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        const config = await getFSService().readConfig(tabPath);
        if (config.cards && config.cards[card.fileName]) {
            delete config.cards[card.fileName];
            if (config.tab?.order) config.tab.order = config.tab.order.filter(n => n !== card.fileName);
            await getFSService().writeConfig(tabPath, config);
        }
        await refreshTabs();
        uiState.showToast(`Видалено: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to delete card', err);
        uiState.showToast('Помилка видалення!');
    }
}

async function duplicateCard(card: Card): Promise<void> {
    try {
        const ext = card.extension;
        const nameWithoutExt = card.fileName.slice(0, -ext.length);
        const newFileName = `${nameWithoutExt}_copy${ext}`;
        await getFSService().copyFile(card.filePath, newFileName);
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        const config = await getFSService().readConfig(tabPath);
        if (config.cards && config.cards[card.fileName]) {
            config.cards[newFileName] = JSON.parse(JSON.stringify(config.cards[card.fileName]));
            await getFSService().writeConfig(tabPath, config);
        }
        await refreshTabs();
        uiState.showToast(`Дубльовано: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to duplicate card', err);
        uiState.showToast('Помилка дублювання!');
    }
}

async function moveCardToTab(card: Card, targetTabPath: string): Promise<void> {
    try {
        await getFSService().moveFile(card.filePath, targetTabPath);
        await refreshTabs();
        uiState.showToast(`Переміщено в іншу вкладку`);
    } catch (err) {
        logService.log('error', 'Failed to move card', err);
        uiState.showToast('Помилка переміщення!');
    }
}

function moveCard(fromIndex: number, toIndex: number): void {
    const tab = fsState.activeTab;
    if (!tab || fromIndex < 0 || toIndex < 0 || fromIndex >= tab.cards.length || toIndex >= tab.cards.length) return;
    const cardToMove = tab.cards[fromIndex];
    tab.cards.splice(fromIndex, 1);
    tab.cards.splice(toIndex, 0, cardToMove);
    debouncedSaveTabConfig();
}

function moveCardRelative(card: Card, delta: number): void {
    const tab = fsState.activeTab;
    if (!tab) return;
    const fromIndex = tab.cards.findIndex(c => c.filePath === card.filePath);
    if (fromIndex === -1) return;
    const toIndex = fromIndex + delta;
    if (toIndex < 0 || toIndex >= tab.cards.length) return;
    moveCard(fromIndex, toIndex);
}

async function renamePhysicalFile(card: Card, newFileName: string): Promise<void> {
    if (!newFileName || newFileName === card.fileName) return;
    if (!newFileName.includes('.')) newFileName += card.extension;
    try {
        const oldFileName = card.fileName;
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        await getFSService().renameFile(card.filePath, newFileName);
        const config = await getFSService().readConfig(tabPath);
        if (config.cards && config.cards[oldFileName]) {
            config.cards[newFileName] = { ...config.cards[oldFileName] };
            delete config.cards[oldFileName];
            if (config.tab?.order) config.tab.order = config.tab.order.map(n => n === oldFileName ? newFileName : n);
            await getFSService().writeConfig(tabPath, config);
        }
        await refreshTabs();
        uiState.showToast(`Файл перейменовано на ${newFileName}`);
    } catch (err) {
        logService.log('error', 'Failed to rename file', err);
        uiState.showToast('Помилка перейменування файлу!');
    }
}

async function createNewTab(name: string, type: TabType = 'snippets'): Promise<void> {
    try {
        await getFSService().createDirectory(name);
        
        // Initialize config with the correct type
        const config = await getFSService().readConfig(name);
        if (!config.tab) config.tab = {};
        config.tab.type = type;
        await getFSService().writeConfig(name, config);

        await refreshTabs();
        uiState.showToast(`Вкладку "${name}" створно (${type})`);
    } catch (err) {
        logService.log('error', 'Failed to create tab', err);
        uiState.showToast('Помилка створення вкладки!');
    }
}

async function deleteTab(tab: Tab): Promise<void> {
    if (tab.path === '__root__') {
        uiState.showToast('Неможливо видалити кореневу вкладку');
        return;
    }
    if (!confirm(`Ви впевнені, що хочете видалити вкладку "${tab.name}" з усіма файлами?`)) return;
    try {
        await getFSService().deleteDirectory(tab.path);
        const rootConfig = await getFSService().readConfig('__root__');
        if (rootConfig.tab?.tabOrder) {
            rootConfig.tab.tabOrder = rootConfig.tab.tabOrder.filter(p => p !== tab.path);
            if (rootConfig.tabs) delete rootConfig.tabs[tab.path];
            await getFSService().writeConfig('__root__', rootConfig);
        }
        await refreshTabs();
        uiState.showToast(`Вкладку "${tab.name}" видалено`);
    } catch (err) {
        logService.log('error', 'Failed to delete tab', err);
        uiState.showToast('Помилка видалення вкладки!');
    }
}

async function renamePhysicalTab(tab: Tab, newDirName: string): Promise<void> {
    if (!newDirName || newDirName === tab.path || tab.path === '__root__') return;
    try {
        const oldPath = tab.path;
        await getFSService().renameDirectory(oldPath, newDirName);
        const rootConfig = await getFSService().readConfig('__root__');
        if (rootConfig.tab?.tabOrder) rootConfig.tab.tabOrder = rootConfig.tab.tabOrder.map(p => p === oldPath ? newDirName : p);
        if (rootConfig.tabs && rootConfig.tabs[oldPath]) {
            rootConfig.tabs[newDirName] = { ...rootConfig.tabs[oldPath] };
            delete rootConfig.tabs[oldPath];
        }
        await getFSService().writeConfig('__root__', rootConfig);
        await refreshTabs();
        uiState.showToast(`Вкладку перейменовано на ${newDirName}`);
    } catch (err) {
        logService.log('error', 'Failed to rename tab directory', err);
        uiState.showToast('Помилка перейменування папки!');
    }
}

async function updateTabSettings(tab: Tab, settings: Partial<Tab>): Promise<void> {
    Object.assign(tab, settings);
    if (settings.displayName === "") tab.displayName = null;
    tab.name = tab.displayName || (tab.path === '__root__' ? 'Файли' : tab.path);
    try {
        const rootConfig = await getFSService().readConfig('__root__');
        if (tab.path === '__root__') {
            if (!rootConfig.tab) rootConfig.tab = {};
            rootConfig.tab.displayName = tab.displayName;
            rootConfig.tab.icon = tab.icon;
            rootConfig.tab.color = tab.color;
            rootConfig.tab.type = tab.type;
            rootConfig.tab.assignments = tab.assignments;
        } else {
            if (!rootConfig.tabs) rootConfig.tabs = {};
            if (!rootConfig.tabs[tab.path]) rootConfig.tabs[tab.path] = {};
            const tMeta = rootConfig.tabs[tab.path];
            tMeta.displayName = tab.displayName;
            tMeta.icon = tab.icon;
            tMeta.color = tab.color;
            tMeta.type = tab.type;
            tMeta.assignments = tab.assignments;
            if (Object.keys(tMeta).length === 0) delete rootConfig.tabs[tab.path];
        }
        await getFSService().writeConfig('__root__', rootConfig);
        
        // Also write to the tab's local config for portability
        const localConfig = await getFSService().readConfig(tab.path);
        if (!localConfig.tab) localConfig.tab = {};
        localConfig.tab.displayName = tab.displayName;
        localConfig.tab.icon = tab.icon;
        localConfig.tab.color = tab.color;
        localConfig.tab.type = tab.type;
        localConfig.tab.assignments = tab.assignments;
        await getFSService().writeConfig(tab.path, localConfig);

        uiState.showToast(`Налаштування вкладки збережено`);
    } catch (err) {
        logService.log('error', 'Failed to save tab settings', err);
    }
}

async function updateTabAssignment(keyCode: string, shortcut: any | 'none'): Promise<void> {
    // Priority: 1. Tab from picker context, 2. Global active tab
    const targetTab = uiState.activeProgramPicker?.tab || fsState.activeTab;
    
    if (!targetTab) {
        logService.error('fsstate', 'updateTabAssignment: No target tab found');
        return;
    }

    if (targetTab.type !== 'keyboard') {
        logService.warn('fsstate', `updateTabAssignment: Target tab "${targetTab.name}" is not a keyboard tab (type: ${targetTab.type})`);
        return;
    }

    logService.info('fsstate', `updateTabAssignment: Updating key ${keyCode} in tab "${targetTab.name}"`, shortcut);

    // Ensure assignments is initialized
    if (!targetTab.assignments) targetTab.assignments = {};
    
    // Create a new reference for reactivity in Svelte 5
    const newAssignments = { ...targetTab.assignments };
    
    if (shortcut === 'none') {
        delete newAssignments[keyCode];
    } else {
        newAssignments[keyCode] = shortcut;
    }

    // Assign the NEW object back to trigger $derived updates
    targetTab.assignments = newAssignments;

    await updateTabSettings(targetTab, { assignments: targetTab.assignments });
}

async function duplicateTab(tab: Tab): Promise<void> {
    if (tab.path === '__root__') return;
    try {
        const newPath = `${tab.path}_copy`;
        await getFSService().createDirectory(newPath);
        for (const card of tab.cards) await getFSService().copyFile(card.filePath, `${newPath}/${card.fileName}`);
        const config = await getFSService().readConfig(tab.path);
        await getFSService().writeConfig(newPath, config);
        await refreshTabs();
        uiState.showToast(`Вкладку дубльовано: ${newPath}`);
    } catch (err) {
        logService.log('error', 'Failed to duplicate tab', err);
        uiState.showToast('Помилка дублювання вкладки!');
    }
}

let tabOrderSaveTimeout: ReturnType<typeof setTimeout> | null = null;

async function saveTabOrder() {
    try {
        const rootConfig = await getFSService().readConfig('__root__');
        if (!rootConfig.tab) rootConfig.tab = {};
        rootConfig.tab.tabOrder = tabs.filter(t => t.path !== '__root__').map(t => t.path);
        await getFSService().writeConfig('__root__', rootConfig);
    } catch (err) {
        logService.log('error', 'Failed to save tab order', err);
    }
}

function debouncedSaveTabOrder() {
    if (tabOrderSaveTimeout) clearTimeout(tabOrderSaveTimeout);
    tabOrderSaveTimeout = setTimeout(() => saveTabOrder(), 500);
}

async function moveTab(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= tabs.length || toIndex >= tabs.length) return;
    const movedTab = tabs[fromIndex];
    tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, movedTab);
    debouncedSaveTabOrder();
}

function toggleStrikethrough(card: Card, lineIndex: number): void {
    const sIdx = card.strikethrough.indexOf(lineIndex);
    if (sIdx === -1) {
        card.strikethrough.push(lineIndex);
        card.strikethrough.sort((a, b) => a - b);
    } else {
        card.strikethrough.splice(sIdx, 1);
    }
    debouncedSaveTabConfig();
}

function startNewCardCreation(): void {
    const tab = fsState.activeTab;
    if (!tab) return;
    const tempId = `new-${Date.now()}`;
    const mockCard: Card = {
        id: tempId, name: "New Snippet", fileName: "", filePath: tempId, content: "", extension: "txt",
        displayName: null, hotkey: '', icon: null, color: null, borderColor: null, strikethrough: [],
        size: 0, lastModified: 0, isNewMock: true
    };
    tab.cards = [mockCard, ...tab.cards];
}

async function removeOrphanedConfig(card: Card): Promise<void> {
    try {
        const parts = card.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        const config = await getFSService().readConfig(tabPath);
        if (config.cards && config.cards[card.fileName]) {
            delete config.cards[card.fileName];
            if (config.tab?.order) config.tab.order = config.tab.order.filter((n: string) => n !== card.fileName);
            await getFSService().writeConfig(tabPath, config);
        }
        await refreshTabs();
        uiState.showToast("Видалено з конфігурації");
    } catch (err) {
        logService.log('error', 'Failed to remove orphaned config', err);
    }
}

async function linkFileManually(ghostCard: Card, realFileName: string): Promise<void> {
    try {
        const parts = ghostCard.filePath.split('/');
        parts.pop();
        const tabPath = parts.join('/') || '__root__';
        const config = await getFSService().readConfig(tabPath);
        if (config.cards && config.cards[ghostCard.fileName]) {
            const metadata = { ...config.cards[ghostCard.fileName] };
            delete config.cards[ghostCard.fileName];
            config.cards[realFileName] = metadata;
            if (config.tab?.order) config.tab.order = config.tab.order.map((n: string) => n === ghostCard.fileName ? realFileName : n);
            await getFSService().writeConfig(tabPath, config);
        }
        await refreshTabs();
        uiState.showToast("Зв'язок відновлено");
    } catch (err) {
        logService.log('error', 'Failed to link file manually', err);
    }
}

async function updateCardHotkey(card: Card, newHotkey: string): Promise<void> {
    card.hotkey = newHotkey;
    card.isCustomHotkey = true; // Forcing it to be custom even if empty (Disabled mode)
    card.isHotkeyConflicting = false;
    await saveCurrentTabConfig();
    await refreshTabs();
    uiState.showToast(newHotkey ? `Гарячу клавішу оновлено` : `Гарячу клавішу вимкнено`);
}

async function resetCardHotkeyToDefault(card: Card): Promise<void> {
    card.hotkey = '';
    card.isCustomHotkey = false; // System will auto-assign
    await saveCurrentTabConfig();
    await refreshTabs();
    uiState.showToast(`Повернуто до автоматичного призначення`);
}

async function resolveHotkeyConflict(selectedCard: Card): Promise<void> {
    const conflict = uiState.activeHotkeyConflict;
    const tab = fsState.activeTab;
    if (!conflict || !tab) return;
    selectedCard.hotkey = conflict.code;
    selectedCard.isCustomHotkey = true;
    selectedCard.isHotkeyConflicting = false;
    for (const card of tab.cards) {
        if (card !== selectedCard && card.hotkey.toLowerCase() === conflict.code.toLowerCase()) {
            card.hotkey = '';
            card.isCustomHotkey = true;
            card.isHotkeyConflicting = false;
        }
    }
    uiState.closeHotkeyConflict();
    await saveCurrentTabConfig();
    await refreshTabs();
    uiState.showToast(`Гарячу клавішу закріплено за: ${selectedCard.name}`);
}

async function updateCardSettings(card: Card, settings: Partial<Card>): Promise<void> {
    Object.assign(card, settings);
    if (settings.displayName === "") card.displayName = null;
    card.name = card.displayName || card.fileName.replace(/\.[^/.]+$/, "");
    await saveCurrentTabConfig();
    uiState.showToast(`Налаштування збережено: ${card.name}`);
}

async function copyCard(card: Card): Promise<void> {
    try {
        const lines = card.content.split('\n');
        const activeLines = lines.filter((_, idx) => !card.strikethrough.includes(idx));
        await navigator.clipboard.writeText(activeLines.join('\n'));
        uiState.showFlash(card.filePath);
        uiState.showToast(`Скопійовано: ${card.name}`);
    } catch (err) {
        logService.log('error', 'Failed to copy card', err);
        uiState.showToast('Помилка копіювання!');
    }
}

/**
 * Automatically assign hotkeys to cards that don't have a custom one.
 */
function autoAssignHotkeys(tab: Tab): void {
    // 1. Collect all explicitly assigned hotkeys to avoid them
    const takenKeys = new Set<string>();
    for (const card of tab.cards) {
        if (card.isCustomHotkey && card.hotkey) {
            takenKeys.add(card.hotkey.toLowerCase());
        }
    }

    // 2. Assign first available QWERTY keys to cards without custom hotkeys
    let qwertyIndex = 0;
    for (const card of tab.cards) {
        if (!card.isCustomHotkey) {
            // Find next free key in QWERTY layout
            while (qwertyIndex < QWERTY_CODES.length && takenKeys.has(QWERTY_CODES[qwertyIndex].toLowerCase())) {
                qwertyIndex++;
            }

            if (qwertyIndex < QWERTY_CODES.length) {
                card.hotkey = QWERTY_CODES[qwertyIndex];
                takenKeys.add(card.hotkey.toLowerCase());
                qwertyIndex++;
            } else {
                card.hotkey = ''; // No keys left
            }
        }
    }
}
