/**
 * File System Service — Abstract interface and browser-based implementation.
 */

import { QWERTY_CODES } from '../utils/keyboardLayout';
import type { Tab, Card, HotPasteConfig } from '../types';
import { CONFIG_FILENAME } from '../types';
import { HotPasteConfigSchema } from '../schemas/config';
import { TauriFileSystemService } from './tauriFileSystem';

export interface IFileSystemService {
    requestAccess(): Promise<boolean>;
    hasAccess(): boolean;
    getRootName(): string;
    readDirectory(): Promise<Tab[]>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    renameFile(path: string, newName: string): Promise<void>;
    copyFile(path: string, newName: string): Promise<void>;
    moveFile(path: string, targetTabPath: string): Promise<void>;
    createDirectory(name: string): Promise<void>;
    deleteDirectory(path: string): Promise<void>;
    renameDirectory(path: string, newName: string): Promise<void>;
    readConfig(tabPath: string): Promise<HotPasteConfig>;
    writeConfig(tabPath: string, config: HotPasteConfig): Promise<void>;
    setProjectRoot(path: string | null): Promise<boolean>;
}

const SUPPORTED_EXTENSIONS = ['.txt', '.md'];

/**
 * Browser-based implementation using File System Access API.
 */
class LocalFileSystemService implements IFileSystemService {
    private rootHandle: FileSystemDirectoryHandle | null = null;

    async setProjectRoot(_path: string | null): Promise<boolean> {
        // Browser cannot set specific path without user interaction
        return false;
    }

    async requestAccess(): Promise<boolean> {
        try {
            this.rootHandle = await (window as any).showDirectoryPicker({
                mode: 'readwrite'
            });
            return true;
        } catch (err) {
            console.error('Directory access denied', err);
            return false;
        }
    }

    hasAccess(): boolean {
        return this.rootHandle !== null;
    }

    getRootName(): string {
        return this.rootHandle?.name || '';
    }

    async readDirectory(): Promise<Tab[]> {
        if (!this.rootHandle) return [];

        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];
        const rootConfig = await this.readConfig('__root__');

        for await (const entry of (this.rootHandle as any).values()) {
            const name = entry.name;
            if (entry.kind === 'directory') {
                const config = await this.readConfig(name);
                const rootTabMeta = rootConfig.tabs?.[name] || {};
                const cards = await this.readCardsFromDirectory(entry, config);

                if (cards.length > 0 || (config.tab && Object.keys(config.tab).length > 0) || rootTabMeta) {
                    tabs.push({
                        name: rootTabMeta.displayName || config.tab?.displayName || this.cleanName(name),
                        displayName: rootTabMeta.displayName || config.tab?.displayName || null,
                        hotkey: '',
                        cards,
                        path: name,
                        icon: rootTabMeta.icon || config.tab?.icon || null,
                        color: rootTabMeta.color || config.tab?.color || null,
                        type: config.tab?.type || rootTabMeta.type || 'snippets',
                        assignments: config.tab?.assignments || rootTabMeta.assignments || {},
                    });
                }
            } else if (entry.kind === 'file') {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext) && name !== CONFIG_FILENAME) {
                    const content = await this.readFileInternal(entry);
                    const cardConfig = rootConfig.cards?.[name] || {};
                    rootFiles.push({
                        id: `__root__/${name}`,
                        name: cardConfig.displayName || this.cleanName(name),
                        displayName: cardConfig.displayName || null,
                        content,
                        hotkey: cardConfig.hotkey || '',
                        isCustomHotkey: cardConfig.hotkey !== undefined,
                        filePath: `__root__/${name}`,
                        fileName: name,
                        extension: ext,
                        icon: cardConfig.icon || null,
                        color: cardConfig.color || null,
                        borderColor: cardConfig.borderColor || null,
                        strikethrough: cardConfig.strikethrough || [],
                        size: 0,
                        lastModified: Date.now(),
                    });
                }
            }
        }

        const tabOrder = rootConfig.tab?.tabOrder || [];
        tabs.sort((a, b) => {
            const indexA = tabOrder.indexOf(a.path);
            const indexB = tabOrder.indexOf(b.path);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            return a.path.localeCompare(b.path);
        });

        if (rootFiles.length > 0) {
            tabs.unshift({
                name: rootConfig.tab?.displayName || 'Файли',
                displayName: rootConfig.tab?.displayName || null,
                hotkey: '',
                cards: rootFiles,
                path: '__root__',
                icon: rootConfig.tab?.icon || null,
                color: rootConfig.tab?.color || null,
                type: rootConfig.tab?.type || 'snippets',
                assignments: rootConfig.tab?.assignments || {},
            });
        }

        return tabs;
    }

    async readFile(path: string): Promise<string> {
        const handle = await this.getFileHandle(path);
        return this.readFileInternal(handle);
    }

    async writeFile(path: string, content: string): Promise<void> {
        const handle = await this.getFileHandle(path, true);
        const writable = await (handle as any).createWritable();
        await writable.write(content);
        await writable.close();
    }

    async deleteFile(path: string): Promise<void> {
        const parts = path.split('/');
        const fileName = parts.pop()!;
        const dirPath = parts.join('/') || '__root__';
        const dirHandle = await this.getDirectoryHandle(dirPath);
        await dirHandle.removeEntry(fileName);
    }

    async renameFile(path: string, newName: string): Promise<void> {
        const handle = await this.getFileHandle(path);
        const content = await this.readFileInternal(handle);
        await this.writeFile(path.split('/').slice(0, -1).concat(newName).join('/'), content);
        await this.deleteFile(path);
    }

    async copyFile(path: string, newName: string): Promise<void> {
        const content = await this.readFile(path);
        const newPath = path.split('/').slice(0, -1).concat(newName).join('/');
        await this.writeFile(newPath, content);
    }

    async moveFile(path: string, targetTabPath: string): Promise<void> {
        const content = await this.readFile(path);
        const fileName = path.split('/').pop()!;
        const newPath = targetTabPath === '__root__' ? `__root__/${fileName}` : `${targetTabPath}/${fileName}`;
        await this.writeFile(newPath, content);
        await this.deleteFile(path);
    }

    async createDirectory(name: string): Promise<void> {
        if (!this.rootHandle) return;
        await this.rootHandle.getDirectoryHandle(name, { create: true });
    }

    async deleteDirectory(path: string): Promise<void> {
        if (!this.rootHandle || path === '__root__') return;
        await this.rootHandle.removeEntry(path, { recursive: true });
    }

    async renameDirectory(path: string, newName: string): Promise<void> {
        // Renaming directories in FS API is basically moving all files.
        // Simplified: not fully implemented for browser version.
        console.warn('Rename directory not implemented for browser');
    }

    async readConfig(tabPath: string): Promise<HotPasteConfig> {
        try {
            const configPath = tabPath === '__root__' ? CONFIG_FILENAME : `${tabPath}/${CONFIG_FILENAME}`;
            const content = await this.readFile(configPath);
            const raw = JSON.parse(content);
            const result = HotPasteConfigSchema.safeParse(raw);
            return result.success ? result.data : { tab: {}, cards: {} };
        } catch {
            return { tab: {}, cards: {} };
        }
    }

    async writeConfig(tabPath: string, config: HotPasteConfig): Promise<void> {
        const configPath = tabPath === '__root__' ? CONFIG_FILENAME : `${tabPath}/${CONFIG_FILENAME}`;
        await this.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    private async readCardsFromDirectory(dirHandle: FileSystemDirectoryHandle, config: HotPasteConfig): Promise<Card[]> {
        const cards: Card[] = [];
        const dirName = dirHandle.name;

        for await (const entry of (dirHandle as any).values()) {
            if (entry.kind === 'file') {
                const ext = this.getExtension(entry.name);
                if (SUPPORTED_EXTENSIONS.includes(ext) && entry.name !== CONFIG_FILENAME) {
                    const content = await this.readFileInternal(entry);
                    const cardConfig = config.cards?.[entry.name] || {};
                    const file = await entry.getFile();

                    cards.push({
                        id: `${dirName}/${entry.name}`,
                        name: cardConfig.displayName || this.cleanName(entry.name),
                        displayName: cardConfig.displayName || null,
                        content,
                        hotkey: cardConfig.hotkey || '',
                        isCustomHotkey: cardConfig.hotkey !== undefined,
                        filePath: `${dirName}/${entry.name}`,
                        fileName: entry.name,
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
        return cards;
    }

    private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
        if (!this.rootHandle) throw new Error("No root handle");
        const parts = path.split('/');
        if (parts[0] === '__root__') parts.shift();
        
        let current: FileSystemDirectoryHandle = this.rootHandle;
        while (parts.length > 1) {
            current = await current.getDirectoryHandle(parts.shift()!, { create });
        }
        return current.getFileHandle(parts[0], { create });
    }

    private async getDirectoryHandle(path: string): Promise<FileSystemDirectoryHandle> {
        if (!this.rootHandle) throw new Error("No root handle");
        if (path === '__root__') return this.rootHandle;
        return this.rootHandle.getDirectoryHandle(path);
    }

    private async readFileInternal(handle: FileSystemFileHandle): Promise<string> {
        const file = await handle.getFile();
        return file.text();
    }

    private getExtension(f: string): string { const i = f.lastIndexOf('.'); return i >= 0 ? f.slice(i).toLowerCase() : ''; }
    private cleanName(n: string): string { const i = n.lastIndexOf('.'); const w = i >= 0 ? n.slice(0, i) : n; return w.replace(/^\d+[\_\-\s]+/, '') || w; }
}

/**
 * Singleton factory
 */
export function createFileSystemService(): IFileSystemService {
    // Determine if running in Tauri environment
    // @ts-ignore
    const isTauri = typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__);
    
    if (isTauri) {
        return new TauriFileSystemService();
    }
    
    return new LocalFileSystemService();
}
