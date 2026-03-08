/**
 * File System Service — Data Layer abstraction.
 *
 * Provides an interface for file system operations that can be
 * swapped between Browser (File System Access API), Node.js, or Tauri backends.
 */

import type { Tab, Card, HotPasteConfig } from '../types';
import { CONFIG_FILENAME, DEFAULT_HOTPASTE_CONFIG } from '../types';
import { getTabHotkey, getCardHotkey } from '../utils/keyboardLayout';

/** Supported file extensions for snippets */
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.prompt', '.snippet'];

/**
 * Interface for file system operations.
 * Implement this for different backends (browser, desktop, etc.)
 */
export interface IFileSystemService {
    /** Request user to grant access to a directory */
    requestAccess(): Promise<boolean>;
    /** Check if we currently have access */
    hasAccess(): boolean;
    /** Read the directory structure and return tabs with cards */
    readDirectory(): Promise<Tab[]>;
    /** Read a single file's content */
    readFile(path: string): Promise<string>;
    /** Write content to a file */
    writeFile(path: string, content: string): Promise<void>;
    /** Read tab config */
    readConfig(tabPath: string): Promise<HotPasteConfig>;
    /** Write tab config */
    writeConfig(tabPath: string, config: HotPasteConfig): Promise<void>;
    /** Get the root directory name */
    getRootName(): string;
}

/**
 * Browser implementation using File System Access API.
 * Works in Chromium-based browsers (Chrome, Edge).
 */
export class BrowserFileSystemService implements IFileSystemService {
    private rootHandle: FileSystemDirectoryHandle | null = null;
    private rootName: string = '';

    hasAccess(): boolean {
        return this.rootHandle !== null;
    }

    getRootName(): string {
        return this.rootName;
    }

    async requestAccess(): Promise<boolean> {
        try {
            // @ts-ignore — showDirectoryPicker may not be in all TS lib definitions
            this.rootHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
            });
            this.rootName = this.rootHandle!.name;
            return true;
        } catch (err) {
            // User cancelled the picker or API not supported
            console.warn('[FileSystem] Access denied or cancelled:', err);
            return false;
        }
    }

    async readDirectory(): Promise<Tab[]> {
        if (!this.rootHandle) {
            throw new Error('No directory access. Call requestAccess() first.');
        }

        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];

        // Read root config if exists
        const rootConfig = await this.readConfigInternal(this.rootHandle);

        // Iterate over entries in the root directory
        // @ts-ignore — entries() may not be in all TS lib definitions
        for await (const [name, handle] of this.rootHandle.entries()) {
            if (handle.kind === 'directory') {
                // Subdirectory = Tab
                const dirHandle = handle as FileSystemDirectoryHandle;
                const config = await this.readConfigInternal(dirHandle);
                const cards = await this.readCardsFromDirectory(dirHandle, name, config);

                if (cards.length > 0) {
                    tabs.push({
                        name: config.tab?.displayName || this.cleanName(name),
                        hotkey: '', // will be assigned later
                        cards,
                        path: name,
                        icon: config.tab?.icon || null,
                        color: config.tab?.color || null,
                    });
                }
            } else if (handle.kind === 'file') {
                // Root-level file = card in a default tab
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const content = await file.text();

                    const cardConfig = rootConfig.cards?.[name] || {};

                    rootFiles.push({
                        name: cardConfig.displayName || this.cleanName(name),
                        content,
                        hotkey: cardConfig.hotkey || '',
                        filePath: name,
                        fileName: name,
                        extension: ext,
                        icon: cardConfig.icon || null,
                        color: cardConfig.color || null,
                        borderColor: cardConfig.borderColor || null,
                        strikethrough: cardConfig.strikethrough || [],
                    });
                }
            }
        }

        // Sort tabs alphabetically by original path, unless config dictates otherwise (can be added later)
        tabs.sort((a, b) => a.path.localeCompare(b.path));

        // If there are root-level files, add them as the first tab
        if (rootFiles.length > 0) {
            tabs.unshift({
                name: rootConfig.tab?.displayName || '📄 Файли',
                hotkey: '',
                cards: rootFiles,
                path: '__root__',
                icon: rootConfig.tab?.icon || null,
                color: rootConfig.tab?.color || null,
            });
        }

        // Assign automatic hotkeys, respecting custom ones from config
        tabs.forEach((tab, i) => {
            tab.hotkey = getTabHotkey(i);

            // Collect used hotkeys in this tab to avoid collisions
            const usedHotkeys = new Set<string>();
            tab.cards.forEach(card => {
                if (card.hotkey) {
                    usedHotkeys.add(card.hotkey.toLowerCase());
                }
            });

            // Assign hotkeys to cards that don't have them
            let autoHotkeyIndex = 0;
            tab.cards.forEach(card => {
                if (!card.hotkey) {
                    let nextHotkey = getCardHotkey(autoHotkeyIndex);
                    // Skip hotkeys that are already custom assigned
                    while (usedHotkeys.has(nextHotkey) && nextHotkey !== '') {
                        autoHotkeyIndex++;
                        nextHotkey = getCardHotkey(autoHotkeyIndex);
                    }
                    card.hotkey = nextHotkey;
                    usedHotkeys.add(nextHotkey);
                    autoHotkeyIndex++;
                }
            });
        });

        return tabs;
    }

    async readFile(path: string): Promise<string> {
        const fileHandle = await this.getFileHandleFromPath(path);
        const file = await fileHandle.getFile();
        return file.text();
    }

    async writeFile(path: string, content: string): Promise<void> {
        const fileHandle = await this.getFileHandleFromPath(path, true);
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    async readConfig(tabPath: string): Promise<HotPasteConfig> {
        if (!this.rootHandle) throw new Error('No directory access.');

        let dirHandle = this.rootHandle;
        if (tabPath !== '__root__') {
            dirHandle = await this.rootHandle.getDirectoryHandle(tabPath);
        }

        return this.readConfigInternal(dirHandle);
    }

    async writeConfig(tabPath: string, config: HotPasteConfig): Promise<void> {
        if (!this.rootHandle) throw new Error('No directory access.');

        let dirHandle = this.rootHandle;
        if (tabPath !== '__root__') {
            dirHandle = await this.rootHandle.getDirectoryHandle(tabPath);
        }

        const fileHandle = await dirHandle.getFileHandle(CONFIG_FILENAME, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(config, null, 2));
        await writable.close();
    }

    // --- Private helpers ---

    private async readConfigInternal(dirHandle: FileSystemDirectoryHandle): Promise<HotPasteConfig> {
        try {
            const fileHandle = await dirHandle.getFileHandle(CONFIG_FILENAME);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const parsed = JSON.parse(text);
            return {
                tab: parsed.tab || {},
                cards: parsed.cards || {},
            };
        } catch (err) {
            // File doesn't exist or is invalid JSON
            return { tab: {}, cards: {} };
        }
    }

    private async getFileHandleFromPath(path: string, create: boolean = false): Promise<FileSystemFileHandle> {
        if (!this.rootHandle) throw new Error('No directory access.');

        const parts = path.split('/');
        let dirHandle: FileSystemDirectoryHandle = this.rootHandle;

        let startIndex = 0;
        if (parts[0] === '__root__') {
            startIndex = 1;
        }

        for (let i = startIndex; i < parts.length - 1; i++) {
            dirHandle = await dirHandle.getDirectoryHandle(parts[i]);
        }

        return await dirHandle.getFileHandle(parts[parts.length - 1], { create });
    }

    private async readCardsFromDirectory(
        dirHandle: FileSystemDirectoryHandle,
        dirPath: string,
        config: HotPasteConfig
    ): Promise<Card[]> {
        const cards: Card[] = [];

        // @ts-ignore
        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file' && name !== CONFIG_FILENAME) {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const content = await file.text();

                    const cardConfig = config.cards?.[name] || {};

                    cards.push({
                        name: cardConfig.displayName || this.cleanName(name),
                        content,
                        hotkey: cardConfig.hotkey || '',
                        filePath: `${dirPath}/${name}`,
                        fileName: name,
                        extension: ext,
                        icon: cardConfig.icon || null,
                        color: cardConfig.color || null,
                        borderColor: cardConfig.borderColor || null,
                        strikethrough: cardConfig.strikethrough || [],
                    });
                }
            }
        }

        // Sort cards alphabetically by original filename
        cards.sort((a, b) => a.fileName.localeCompare(b.fileName));
        return cards;
    }

    private getExtension(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
    }

    private cleanName(name: string): string {
        const lastDot = name.lastIndexOf('.');
        const withoutExt = lastDot >= 0 ? name.slice(0, lastDot) : name;
        return withoutExt.replace(/^\d+[_\-\s]*/, '');
    }
}
