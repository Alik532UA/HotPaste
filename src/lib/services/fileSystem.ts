/**
 * File System Service — Data Layer abstraction.
 *
 * Provides an interface for file system operations that can be
 * swapped between Browser (File System Access API), Node.js, or Tauri backends.
 */

import type { Tab, Card, HotPasteConfig } from '../types';
import { CONFIG_FILENAME, DEFAULT_HOTPASTE_CONFIG } from '../types';
import { getTabHotkey, getCardHotkey } from '../utils/keyboardLayout';
import { HotPasteConfigSchema } from '../schemas/config';

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
    /** Rename a file */
    renameFile(path: string, newName: string): Promise<string>;
    /** Delete a file */
    deleteFile(path: string): Promise<void>;
    /** Create a new directory (tab) */
    createDirectory(name: string): Promise<void>;
    /** Delete a directory recursively */
    deleteDirectory(path: string): Promise<void>;
    /** Rename a directory (effectively move its content or create new handle) */
    renameDirectory(oldPath: string, newName: string): Promise<string>;
    /** Copy a file to the same directory with a new name */
    copyFile(path: string, newName: string): Promise<string>;
    /** Move a file to another directory */
    moveFile(path: string, targetTabPath: string): Promise<string>;
    /** Get the root directory name */
    getRootName(): string;
    /** Restore config from backup */
    restoreFromBackup(tabPath: string): Promise<HotPasteConfig>;
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

        // Read root config if exists (to get tab order and metadata for subfolders)
        const rootConfig = await this.readConfigInternal(this.rootHandle);

        // Iterate over entries in the root directory
        // @ts-ignore
        for await (const [name, handle] of this.rootHandle.entries()) {
            if (handle.kind === 'directory') {
                // Subdirectory = Tab
                const dirHandle = handle as FileSystemDirectoryHandle;
                const config = await this.readConfigInternal(dirHandle);
                
                // Also look into root config for tab-specific metadata (displayName, icon, color)
                const rootTabMeta = rootConfig.tabs?.[name] || {};
                
                const cards = await this.readCardsFromDirectory(dirHandle, name, config);

                if (cards.length > 0 || (config.tab && Object.keys(config.tab).length > 0) || rootTabMeta) {
                    tabs.push({
                        name: rootTabMeta.displayName || config.tab?.displayName || this.cleanName(name),
                        displayName: rootTabMeta.displayName || config.tab?.displayName || null,
                        hotkey: '', 
                        cards,
                        path: name,
                        icon: rootTabMeta.icon || config.tab?.icon || null,
                        color: rootTabMeta.color || config.tab?.color || null,
                    });
                }
            } else if (handle.kind === 'file') {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const content = await file.text();
                    const cardConfig = rootConfig.cards?.[name] || {};

                    rootFiles.push({
                        id: `__root__/${name}`,
                        name: cardConfig.displayName || this.cleanName(name),
                        displayName: cardConfig.displayName || null,
                        content,
                        hotkey: (cardConfig.hotkey !== undefined ? cardConfig.hotkey : '') as string,
                        isCustomHotkey: cardConfig.hotkey !== undefined,
                        filePath: `__root__/${name}`,
                        fileName: name,
                        extension: ext,
                        icon: cardConfig.icon || null,
                        color: cardConfig.color || null,
                        borderColor: cardConfig.borderColor || null,
                        strikethrough: cardConfig.strikethrough || [],
                        size: file.size,
                        lastModified: file.lastModified,
                    });
                }
            }
        }

        // Sort tabs: root order first, then alphabetical
        const tabOrder = rootConfig.tab?.tabOrder || [];
        tabs.sort((a, b) => {
            if (a.path === '__root__') return -1;
            if (b.path === '__root__') return 1;
            
            const indexA = tabOrder.indexOf(a.path);
            const indexB = tabOrder.indexOf(b.path);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.path.localeCompare(b.path);
        });

        // If there are root-level files, add them as the first tab
        if (rootFiles.length > 0) {
            tabs.unshift({
                name: rootConfig.tab?.displayName || '📄 Файли',
                displayName: rootConfig.tab?.displayName || null,
                hotkey: '',
                cards: rootFiles,
                path: '__root__',
                icon: rootConfig.tab?.icon || null,
                color: rootConfig.tab?.color || null,
            });
        }

        // Assign automatic hotkeys
        tabs.forEach((tab, i) => {
            tab.hotkey = getTabHotkey(i);

            const usedHotkeys = new Set<string>();
            tab.cards.forEach(card => {
                if (card.hotkey) {
                    usedHotkeys.add(card.hotkey.toLowerCase());
                }
            });

            let autoHotkeyIndex = 0;
            tab.cards.forEach(card => {
                // If hotkey was explicitly set (even to ""), do NOT assign an auto-hotkey
                if (!card.isCustomHotkey) {
                    let nextHotkey = getCardHotkey(autoHotkeyIndex);
                    // Ensure case-insensitive check against used keys
                    while (nextHotkey !== '' && usedHotkeys.has(nextHotkey.toLowerCase())) {
                        autoHotkeyIndex++;
                        nextHotkey = getCardHotkey(autoHotkeyIndex);
                    }
                    card.hotkey = nextHotkey;
                    if (nextHotkey) {
                        usedHotkeys.add(nextHotkey.toLowerCase());
                    }
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

        // 1. Create backup of current config if it exists
        try {
            const currentFileHandle = await dirHandle.getFileHandle(CONFIG_FILENAME);
            const currentFile = await currentFileHandle.getFile();
            const currentText = await currentFile.text();
            
            if (currentText.trim()) {
                const backupHandle = await dirHandle.getFileHandle(`${CONFIG_FILENAME}.bak`, { create: true });
                // @ts-ignore
                const backupWritable = await backupHandle.createWritable();
                await backupWritable.write(currentText);
                await backupWritable.close();
            }
        } catch (e) {
            // Config doesn't exist yet, ignore
        }

        // 2. Write new config
        const fileHandle = await dirHandle.getFileHandle(CONFIG_FILENAME, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(config, null, 2));
        await writable.close();
    }

    async restoreFromBackup(tabPath: string): Promise<HotPasteConfig> {
        if (!this.rootHandle) throw new Error('No directory access.');

        let dirHandle = this.rootHandle;
        if (tabPath !== '__root__') {
            dirHandle = await this.rootHandle.getDirectoryHandle(tabPath);
        }

        try {
            const backupHandle = await dirHandle.getFileHandle(`${CONFIG_FILENAME}.bak`);
            const backupFile = await backupHandle.getFile();
            const text = await backupFile.text();
            const parsed = JSON.parse(text);
            const validated = HotPasteConfigSchema.safeParse(parsed);
            
            if (validated.success) {
                // Restore backup as main config
                await this.writeConfig(tabPath, validated.data as HotPasteConfig);
                return validated.data as HotPasteConfig;
            }
            throw new Error('Invalid backup format');
        } catch (err) {
            console.error('[FileSystem] Failed to restore from backup:', err);
            throw err;
        }
    }

    async renameFile(path: string, newName: string): Promise<string> {
        const content = await this.readFile(path);
        const parts = path.split('/');
        parts.pop();
        const dirPath = parts.join('/');
        const newPath = dirPath === '' || dirPath === '__root__' ? newName : `${dirPath}/${newName}`;
        await this.writeFile(newPath, content);
        await this.deleteFile(path);
        return newPath;
    }

    async deleteFile(path: string): Promise<void> {
        if (!this.rootHandle) throw new Error('No directory access.');
        const parts = path.split('/');
        const fileName = parts.pop()!;
        const dirPath = parts.join('/');
        let dirHandle = this.rootHandle;
        if (dirPath !== '' && dirPath !== '__root__') {
            dirHandle = await this.rootHandle.getDirectoryHandle(dirPath);
        }
        await dirHandle.removeEntry(fileName);
    }

    async createDirectory(name: string): Promise<void> {
        if (!this.rootHandle) throw new Error('No directory access.');
        await this.rootHandle.getDirectoryHandle(name, { create: true });
    }

    async deleteDirectory(path: string): Promise<void> {
        if (!this.rootHandle) throw new Error('No directory access.');
        if (path === '__root__') return;
        await this.rootHandle.removeEntry(path, { recursive: true });
    }

    async renameDirectory(oldPath: string, newName: string): Promise<string> {
        if (!this.rootHandle) throw new Error('No directory access.');
        if (oldPath === '__root__') return oldPath;

        const oldDirHandle = await this.rootHandle.getDirectoryHandle(oldPath);
        const newDirHandle = await this.rootHandle.getDirectoryHandle(newName, { create: true });
        
        // @ts-ignore
        for await (const [name, handle] of oldDirHandle.entries()) {
            if (handle.kind === 'file') {
                const fileHandle = handle as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                const newFileHandle = await newDirHandle.getFileHandle(name, { create: true });
                // @ts-ignore
                const writable = await newFileHandle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();
            }
        }
        
        await this.rootHandle.removeEntry(oldPath, { recursive: true });
        return newName;
    }

    async copyFile(path: string, newName: string): Promise<string> {
        const content = await this.readFile(path);
        const parts = path.split('/');
        parts.pop();
        const dirPath = parts.join('/');
        const newPath = dirPath === '' ? newName : `${dirPath}/${newName}`;
        await this.writeFile(newPath, content);
        return newPath;
    }

    async moveFile(path: string, targetTabPath: string): Promise<string> {
        const content = await this.readFile(path);
        const parts = path.split('/');
        const fileName = parts.pop()!;
        const newPath = targetTabPath === '__root__' ? fileName : `${targetTabPath}/${fileName}`;
        await this.writeFile(newPath, content);
        await this.deleteFile(path);
        return newPath;
    }

    private async readConfigInternal(dirHandle: FileSystemDirectoryHandle): Promise<HotPasteConfig> {
        try {
            const fileHandle = await dirHandle.getFileHandle(CONFIG_FILENAME);
            const file = await fileHandle.getFile();
            const text = await file.text();
            const parsed = JSON.parse(text);
            
            const validated = HotPasteConfigSchema.safeParse(parsed);
            if (!validated.success) {
                console.warn(`[FileSystem] Invalid config in ${dirHandle.name}:`, validated.error.format());
                return { tab: {}, cards: {}, tabs: {} };
            }

            return validated.data as HotPasteConfig;
        } catch (err) {
            return { tab: {}, cards: {}, tabs: {} };
        }
    }

    private async getFileHandleFromPath(path: string, create: boolean = false): Promise<FileSystemFileHandle> {
        if (!this.rootHandle) throw new Error('No directory access.');
        const normalizedPath = path.startsWith('__root__/') ? path.slice(9) : path;
        const parts = normalizedPath.split('/');
        let dirHandle: FileSystemDirectoryHandle = this.rootHandle;
        for (let i = 0; i < parts.length - 1; i++) {
            dirHandle = await dirHandle.getDirectoryHandle(parts[i], { create });
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
                    const filePath = `${dirPath}/${name}`;
                    cards.push({
                        id: filePath,
                        name: cardConfig.displayName || this.cleanName(name),
                        displayName: cardConfig.displayName || null,
                        content,
                        hotkey: (cardConfig.hotkey !== undefined ? cardConfig.hotkey : '') as string,
                        isCustomHotkey: cardConfig.hotkey !== undefined,
                        filePath,
                        fileName: name,
                        extension: ext,
                        icon: cardConfig.icon || null,
                        color: cardConfig.color || null,
                        borderColor: cardConfig.borderColor || null,
                        strikethrough: cardConfig.strikethrough || [],
                        size: file.size,
                        lastModified: file.lastModified,
                    });
                }
            }
        }
        const orderArr = config.tab?.order || [];
        cards.sort((a, b) => {
            const indexA = orderArr.indexOf(a.fileName);
            const indexB = orderArr.indexOf(b.fileName);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            else if (indexA !== -1) return -1;
            else if (indexB !== -1) return 1;
            else return a.fileName.localeCompare(b.fileName);
        });
        return cards;
    }

    private getExtension(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
    }

    private cleanName(name: string): string {
        const lastDot = name.lastIndexOf('.');
        const withoutExt = lastDot >= 0 ? name.slice(0, lastDot) : name;
        // Only strip numeric prefix if there is something left after it
        const cleaned = withoutExt.replace(/^\d+[_\-\s]+/, '');
        return cleaned || withoutExt;
    }
}
