/**
 * Tauri File System Service implementation.
 * Uses Tauri's fs and path APIs to access the local file system.
 */

import { readDir, readFile, writeFile, removeFile, createDir, removeDir, renameFile, copyFile, exists, BaseDirectory } from '@tauri-apps/api/fs';
import { documentDir, join, sep } from '@tauri-apps/api/path';
import type { IFileSystemService } from './fileSystem';
import type { Tab, Card } from '../types';
import { HotPasteConfigSchema, MAX_FILE_SIZE, FileNameSchema, type ValidatedHotPasteConfig as HotPasteConfig } from '../schemas/config';
import { logService } from './logService.svelte';

const CONFIG_FILENAME = '_hotpaste.json';
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.prompt', '.snippet'];

export class TauriFileSystemService implements IFileSystemService {
    private rootPath: string = '';
    private isInitialized: boolean = false;

    hasAccess(): boolean {
        return this.isInitialized;
    }

    getRootName(): string {
        return 'HotPaste';
    }

    async requestAccess(): Promise<boolean> {
        try {
            const docs = await documentDir();
            this.rootPath = await join(docs, 'HotPaste');
            
            const rootExists = await exists(this.rootPath);
            if (!rootExists) {
                await createDir(this.rootPath, { recursive: true });
            }
            
            this.isInitialized = true;
            return true;
        } catch (err) {
            logService.error('fileSystem', 'Tauri access failed', err);
            return false;
        }
    }

    async readDirectory(): Promise<Tab[]> {
        if (!this.isInitialized) throw new Error('Not initialized');

        const entries = await readDir(this.rootPath, { recursive: false });
        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];
        const rootConfig = await this.readConfig('__root__');

        for (const entry of entries) {
            const name = entry.name || '';
            if (entry.children) { // It's a directory
                const config = await this.readConfig(name);
                const rootTabMeta = rootConfig.tabs?.[name] || {};
                const cards = await this.readCardsFromDirectory(entry.path, name, config);

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
            } else { // It's a file
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const content = await this.readFileInternal(entry.path);
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
                        size: 0, // Tauri FS API doesn't give size easily in readDir v1
                        lastModified: Date.now(),
                    });
                }
            }
        }

        // Sorting logic remains the same
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
        const fullPath = await this.resolvePath(path);
        return await this.readFileInternal(fullPath);
    }

    async writeFile(path: string, content: string): Promise<void> {
        const fullPath = await this.resolvePath(path);
        await writeFile({ path: fullPath, contents: content });
    }

    async readConfig(tabPath: string): Promise<HotPasteConfig> {
        try {
            const configPath = tabPath === '__root__' 
                ? await join(this.rootPath, CONFIG_FILENAME)
                : await join(this.rootPath, tabPath, CONFIG_FILENAME);
            
            if (!(await exists(configPath))) return { tab: {}, cards: {}, tabs: {} };
            
            const text = await this.readFileInternal(configPath);
            const parsed = JSON.parse(text);
            const validated = HotPasteConfigSchema.safeParse(parsed);
            return validated.success ? (validated.data as HotPasteConfig) : { tab: {}, cards: {}, tabs: {} };
        } catch {
            return { tab: {}, cards: {}, tabs: {} };
        }
    }

    async writeConfig(tabPath: string, config: HotPasteConfig): Promise<void> {
        const dirPath = tabPath === '__root__' ? this.rootPath : await join(this.rootPath, tabPath);
        const configPath = await join(dirPath, CONFIG_FILENAME);

        try {
            if (await exists(configPath)) {
                const currentText = await this.readFileInternal(configPath);
                if (currentText.trim()) {
                    await writeFile({ path: `${configPath}.bak`, contents: currentText });
                }
            }
        } catch {}

        await writeFile({ path: configPath, contents: JSON.stringify(config, null, 2) });
    }

    async restoreFromBackup(tabPath: string): Promise<HotPasteConfig> {
        const dirPath = tabPath === '__root__' ? this.rootPath : await join(this.rootPath, tabPath);
        const backupPath = await join(dirPath, `${CONFIG_FILENAME}.bak`);

        try {
            const text = await this.readFileInternal(backupPath);
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
        const oldPath = await this.resolvePath(path);
        const parts = path.split('/');
        parts.pop();
        const dirPath = parts.join('/');
        const newVirtualPath = dirPath === '' || dirPath === '__root__' ? newName : `${dirPath}/${newName}`;
        const newFullPath = await this.resolvePath(newVirtualPath);
        
        await renameFile(oldPath, newFullPath);
        return newVirtualPath;
    }

    async deleteFile(path: string): Promise<void> {
        const fullPath = await this.resolvePath(path);
        await removeFile(fullPath);
    }

    async createDirectory(name: string): Promise<void> {
        FileNameSchema.parse(name);
        const fullPath = await join(this.rootPath, name);
        await createDir(fullPath);
    }

    async deleteDirectory(path: string): Promise<void> {
        if (path === '__root__') return;
        const fullPath = await join(this.rootPath, path);
        await removeDir(fullPath, { recursive: true });
    }

    async renameDirectory(oldPath: string, newName: string): Promise<string> {
        FileNameSchema.parse(newName);
        const oldFullPath = await join(this.rootPath, oldPath);
        const newFullPath = await join(this.rootPath, newName);
        await renameFile(oldFullPath, newFullPath);
        return newName;
    }

    async copyFile(path: string, newName: string): Promise<string> {
        const oldPath = await this.resolvePath(path);
        const parts = path.split('/');
        parts.pop();
        const dirPath = parts.join('/');
        const newVirtualPath = dirPath === '' ? newName : `${dirPath}/${newName}`;
        const newFullPath = await this.resolvePath(newVirtualPath);
        
        await copyFile(oldPath, newFullPath);
        return newVirtualPath;
    }

    async moveFile(path: string, targetTabPath: string): Promise<string> {
        const oldPath = await this.resolvePath(path);
        const fileName = path.split('/').pop()!;
        const newVirtualPath = targetTabPath === '__root__' ? fileName : `${targetTabPath}/${fileName}`;
        const newFullPath = await this.resolvePath(newVirtualPath);
        
        await renameFile(oldPath, newFullPath);
        return newVirtualPath;
    }

    private async resolvePath(path: string): Promise<string> {
        const normalized = path.startsWith('__root__/') ? path.slice(9) : path;
        return await join(this.rootPath, normalized);
    }

    private async readFileInternal(fullPath: string): Promise<string> {
        return await readFile(fullPath, { dir: undefined }) as unknown as string;
    }

    private async readCardsFromDirectory(fullDirPath: string, virtualDirPath: string, config: HotPasteConfig): Promise<Card[]> {
        const entries = await readDir(fullDirPath);
        const cards: Card[] = [];

        for (const entry of entries) {
            const name = entry.name || '';
            if (!entry.children && name !== CONFIG_FILENAME) {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const content = await this.readFileInternal(entry.path);
                    const cardConfig = config.cards?.[name] || {};
                    cards.push({
                        id: `${virtualDirPath}/${name}`,
                        name: cardConfig.displayName || this.cleanName(name),
                        displayName: cardConfig.displayName || null,
                        content,
                        hotkey: cardConfig.hotkey || '',
                        isCustomHotkey: cardConfig.hotkey !== undefined,
                        filePath: `${virtualDirPath}/${name}`,
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
