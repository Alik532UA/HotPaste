/**
 * File System Service — Data Layer abstraction.
 *
 * Provides an interface for file system operations that can be
 * swapped between Browser (File System Access API), Node.js, or Tauri backends.
 */

import type { Tab, Card } from '../types';
import { getTabHotkey, getCardHotkey } from '../utils/keyboardLayout';
import { HotPasteConfigSchema, MAX_FILE_SIZE, FileNameSchema, type ValidatedHotPasteConfig as HotPasteConfig } from '../schemas/config';
import { logService } from './logService.svelte';

/** Supported file extensions for snippets */
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.prompt', '.snippet'];
const CONFIG_FILENAME = '_hotpaste.json';

import { TauriFileSystemService } from './tauriFileSystem';

/**
 * Interface for file system operations.
 */
export interface IFileSystemService {
    requestAccess(): Promise<boolean>;
    hasAccess(): boolean;
    readDirectory(): Promise<Tab[]>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    readConfig(tabPath: string): Promise<HotPasteConfig>;
    writeConfig(tabPath: string, config: HotPasteConfig): Promise<void>;
    renameFile(path: string, newName: string): Promise<string>;
    deleteFile(path: string): Promise<void>;
    createDirectory(name: string): Promise<void>;
    deleteDirectory(path: string): Promise<void>;
    renameDirectory(oldPath: string, newName: string): Promise<string>;
    copyFile(path: string, newName: string): Promise<string>;
    moveFile(path: string, targetTabPath: string): Promise<string>;
    getRootName(): string;
    restoreFromBackup(tabPath: string): Promise<HotPasteConfig>;
}

/**
 * Factory to create the appropriate file system service.
 */
export function createFileSystemService(): IFileSystemService {
    // @ts-ignore
    if (window.__TAURI__) {
        return new TauriFileSystemService();
    }
    return new BrowserFileSystemService();
}

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
            // @ts-ignore
            this.rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.rootName = this.rootHandle!.name;
            return true;
        } catch (err) {
            logService.error('fileSystem', 'Access denied or cancelled', err);
            return false;
        }
    }

    async readDirectory(): Promise<Tab[]> {
        if (!this.rootHandle) throw new Error('No directory access.');

        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];
        const rootConfig = await this.readConfig('__root__');

        // @ts-ignore
        for await (const [name, handle] of this.rootHandle.entries()) {
            if (handle.kind === 'directory') {
                const dirHandle = handle as FileSystemDirectoryHandle;
                const config = await this.readConfigInternal(dirHandle);
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
                    if (file.size > MAX_FILE_SIZE) continue;

                    const content = await file.text();
                    if (content.includes('\0')) continue;

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
                        size: file.size,
                        lastModified: file.lastModified,
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
                name: rootConfig.tab?.displayName || '📄 Файли',
                displayName: rootConfig.tab?.displayName || null,
                hotkey: '',
                cards: rootFiles,
                path: '__root__',
                icon: rootConfig.tab?.icon || null,
                color: rootConfig.tab?.color || null,
            });
        }

        return tabs;
    }

    async readFile(path: string): Promise<string> {
        const fileHandle = await this.getFileHandleFromPath(path);
        const file = await fileHandle.getFile();
        
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`Файл занадто великий (${Math.round(file.size / 1024)}KB). Ліміт: 1MB.`);
        }

        const text = await file.text();
        if (text.includes('\0')) {
            throw new Error('Файл містить бінарні дані.');
        }

        return text;
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
        } catch {}

        const fileHandle = await dirHandle.getFileHandle(CONFIG_FILENAME, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(config, null, 2));
        await writable.close();
    }

    async restoreFromBackup(tabPath: string): Promise<HotPasteConfig> {
        if (!this.rootHandle) throw new Error('No directory access.');
        let dirHandle = this.rootHandle;
        if (tabPath !== '__root__') dirHandle = await this.rootHandle.getDirectoryHandle(tabPath);

        try {
            const backupHandle = await dirHandle.getFileHandle(`${CONFIG_FILENAME}.bak`);
            const backupFile = await backupHandle.getFile();
            const text = await backupFile.text();
            const parsed = JSON.parse(text);
            const validated = HotPasteConfigSchema.safeParse(parsed);
            if (validated.success) {
                await this.writeConfig(tabPath, validated.data as HotPasteConfig);
                return validated.data as HotPasteConfig;
            }
            throw new Error('Invalid backup format');
        } catch (err) {
            logService.error('fileSystem', 'Failed to restore from backup', err);
            throw err;
        }
    }

    async renameFile(path: string, newName: string): Promise<string> {
        FileNameSchema.parse(newName);
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
        if (dirPath !== '' && dirPath !== '__root__') dirHandle = await this.rootHandle.getDirectoryHandle(dirPath);
        await dirHandle.removeEntry(fileName);
    }

    async createDirectory(name: string): Promise<void> {
        if (!this.rootHandle) throw new Error('No directory access.');
        FileNameSchema.parse(name);
        await this.rootHandle.getDirectoryHandle(name, { create: true });
    }

    async deleteDirectory(path: string): Promise<void> {
        if (!this.rootHandle || path === '__root__') return;
        await this.rootHandle.removeEntry(path, { recursive: true });
    }

    async renameDirectory(oldPath: string, newName: string): Promise<string> {
        FileNameSchema.parse(newName);
        const oldDirHandle = await this.rootHandle!.getDirectoryHandle(oldPath);
        const newDirHandle = await this.rootHandle!.getDirectoryHandle(newName, { create: true });
        // @ts-ignore
        for await (const [name, handle] of oldDirHandle.entries()) {
            if (handle.kind === 'file') {
                const file = await (handle as FileSystemFileHandle).getFile();
                const newFileHandle = await newDirHandle.getFileHandle(name, { create: true });
                // @ts-ignore
                const writable = await newFileHandle.createWritable();
                await writable.write(await file.arrayBuffer());
                await writable.close();
            }
        }
        await this.rootHandle!.removeEntry(oldPath, { recursive: true });
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
            return validated.success ? (validated.data as HotPasteConfig) : { tab: {}, cards: {}, tabs: {} };
        } catch {
            return { tab: {}, cards: {}, tabs: {} };
        }
    }

    private async getFileHandleFromPath(path: string, create: boolean = false): Promise<FileSystemFileHandle> {
        const normalizedPath = path.startsWith('__root__/') ? path.slice(9) : path;
        const parts = normalizedPath.split('/');
        let dirHandle = this.rootHandle!;
        for (let i = 0; i < parts.length - 1; i++) dirHandle = await dirHandle.getDirectoryHandle(parts[i], { create });
        return await dirHandle.getFileHandle(parts[parts.length - 1], { create });
    }

    private async readCardsFromDirectory(dirHandle: FileSystemDirectoryHandle, dirPath: string, config: HotPasteConfig): Promise<Card[]> {
        const cards: Card[] = [];
        // @ts-ignore
        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file' && name !== CONFIG_FILENAME) {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    if (file.size > MAX_FILE_SIZE) continue;
                    const content = await file.text();
                    if (content.includes('\0')) continue;
                    const cardConfig = config.cards?.[name] || {};
                    cards.push({
                        id: `${dirPath}/${name}`, name: cardConfig.displayName || this.cleanName(name),
                        displayName: cardConfig.displayName || null, content,
                        hotkey: cardConfig.hotkey || '',
                        isCustomHotkey: cardConfig.hotkey !== undefined,
                        filePath: `${dirPath}/${name}`, fileName: name, extension: ext,
                        icon: cardConfig.icon || null, color: cardConfig.color || null,
                        borderColor: cardConfig.borderColor || null, strikethrough: cardConfig.strikethrough || [],
                        size: file.size, lastModified: file.lastModified,
                    });
                }
            }
        }
        const orderArr = config.tab?.order || [];
        cards.sort((a, b) => {
            const indexA = orderArr.indexOf(a.fileName);
            const indexB = orderArr.indexOf(b.fileName);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            return a.fileName.localeCompare(b.fileName);
        });
        return cards;
    }

    private getExtension(f: string): string { const i = f.lastIndexOf('.'); return i >= 0 ? f.slice(i).toLowerCase() : ''; }
    private cleanName(n: string): string { const i = n.lastIndexOf('.'); const w = i >= 0 ? n.slice(0, i) : n; return w.replace(/^\d+[_\-\s]+/, '') || w; }
}
