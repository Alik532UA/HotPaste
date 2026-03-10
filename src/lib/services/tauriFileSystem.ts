/**
 * Tauri 2.0 File System Service implementation.
 * Uses @tauri-apps/plugin-fs and @tauri-apps/api/path.
 */

import type { IFileSystemService } from './fileSystem';
import type { Tab, Card, HotPasteConfig } from '../types';
import { CONFIG_FILENAME } from '../types';
import { HotPasteConfigSchema } from '../schemas/config';

export class TauriFileSystemService implements IFileSystemService {
    private cachedApi: any = null;

    private async getApi() {
        if (this.cachedApi) return this.cachedApi;
        const fs = await import('@tauri-apps/plugin-fs');
        const path = await import('@tauri-apps/api/path');
        this.cachedApi = { fs, path };
        return this.cachedApi;
    }

    private async resolvePath(pathStr: string): Promise<string> {
        const { path } = await this.getApi();
        const base = await path.documentDir();
        const fullBase = await path.join(base, 'HotPaste');
        if (pathStr === '__root__') return fullBase;
        if (pathStr.startsWith('__root__/')) {
            return await path.join(fullBase, pathStr.replace('__root__/', ''));
        }
        return await path.join(fullBase, pathStr);
    }

    async requestAccess(): Promise<boolean> {
        // Tauri has system access by default if configured in capabilities
        try {
            const { fs } = await this.getApi();
            const root = await this.resolvePath('__root__');
            if (!(await fs.exists(root))) {
                await fs.mkdir(root, { recursive: true });
            }
            return true;
        } catch (err) {
            console.error('Tauri FS access error:', err);
            return false;
        }
    }

    hasAccess(): boolean {
        return true;
    }

    getRootName(): string {
        return 'Documents/HotPaste';
    }

    async readDirectory(): Promise<Tab[]> {
        const { fs } = await this.getApi();
        const rootPath = await this.resolvePath('__root__');
        const entries = await fs.readDir(rootPath);
        
        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];
        const rootConfig = await this.readConfig('__root__');

        for (const entry of (entries as any[])) {
            const name = entry.name || '';
            if (entry.isDirectory) {
                const config = await this.readConfig(name);
                const rootTabMeta = rootConfig.tabs?.[name] || {};
                const cards = await this.readCardsFromDirectory(name, config);

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
            } else if (entry.isFile) {
                const ext = this.getExtension(name);
                const SUPPORTED_EXTENSIONS = ['.txt', '.md'];
                if (SUPPORTED_EXTENSIONS.includes(ext) && name !== CONFIG_FILENAME) {
                    const content = await this.readFileInternal(`__root__/${name}`);
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
        return this.readFileInternal(path);
    }

    async writeFile(pathStr: string, content: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        const encoder = new TextEncoder();
        await fs.writeFile(fullPath, encoder.encode(content));
    }

    async deleteFile(pathStr: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        await fs.remove(fullPath);
    }

    async renameFile(pathStr: string, newName: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        const parentDir = fullPath.split(/[/\\]/).slice(0, -1).join('/');
        const newFullPath = `${parentDir}/${newName}`;
        await fs.rename(fullPath, newFullPath);
    }

    async createDirectory(name: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(name);
        await fs.mkdir(fullPath, { recursive: true });
    }

    async deleteDirectory(pathStr: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        await fs.remove(fullPath, { recursive: true });
    }

    async renameDirectory(oldPathStr: string, newName: string): Promise<void> {
        const { fs, path } = await this.getApi();
        const oldFullPath = await this.resolvePath(oldPathStr);
        const parentDir = await path.dirname(oldFullPath);
        const newFullPath = await path.join(parentDir, newName);
        await fs.rename(oldFullPath, newFullPath);
    }

    async copyFile(pathStr: string, newName: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        const parentDir = fullPath.split(/[/\\]/).slice(0, -1).join('/');
        const newFullPath = `${parentDir}/${newName}`;
        await fs.copyFile(fullPath, newFullPath);
    }

    async moveFile(pathStr: string, targetTabPath: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        const fileName = fullPath.split(/[/\\]/).pop()!;
        const targetTabFullPath = await this.resolvePath(targetTabPath);
        const newFullPath = `${targetTabFullPath}/${fileName}`;
        await fs.rename(fullPath, newFullPath);
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

    private async readFileInternal(pathStr: string): Promise<string> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        const bytes = await fs.readFile(fullPath);
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    }

    private async readCardsFromDirectory(dirName: string, config: HotPasteConfig): Promise<Card[]> {
        const { fs } = await this.getApi();
        const dirPath = await this.resolvePath(dirName);
        const entries = await fs.readDir(dirPath);
        const cards: Card[] = [];

        for (const entry of (entries as any[])) {
            if (entry.isFile) {
                const ext = this.getExtension(entry.name);
                const SUPPORTED_EXTENSIONS = ['.txt', '.md'];
                if (SUPPORTED_EXTENSIONS.includes(ext) && entry.name !== CONFIG_FILENAME) {
                    const content = await this.readFileInternal(`${dirName}/${entry.name}`);
                    const cardConfig = config.cards?.[entry.name] || {};
                    const fullPath = await this.resolvePath(`${dirName}/${entry.name}`);
                    const stat = await fs.stat(fullPath);

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
                        size: stat.size,
                        lastModified: stat.mtime || Date.now(),
                    });
                }
            }
        }
        return cards;
    }

    private getExtension(f: string): string { const i = f.lastIndexOf('.'); return i >= 0 ? f.slice(i).toLowerCase() : ''; }
    private cleanName(n: string): string { const i = n.lastIndexOf('.'); const w = i >= 0 ? n.slice(0, i) : n; return w.replace(/^\d+[\_\-\s]+/, '') || w; }
}
