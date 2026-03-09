/**
 * Tauri File System Service implementation.
 * Uses Tauri's fs and path APIs to access the local file system.
 * Uses dynamic imports to avoid breaking the web build.
 */

import type { IFileSystemService } from './fileSystem';
import type { Tab, Card } from '../types';
import { HotPasteConfigSchema, MAX_FILE_SIZE, FileNameSchema, type ValidatedHotPasteConfig as HotPasteConfig } from '../schemas/config';
import { logService } from './logService.svelte';

const CONFIG_FILENAME = '_hotpaste.json';
const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.prompt', '.snippet'];

export class TauriFileSystemService implements IFileSystemService {
    private rootPath: string = '';
    private isInitialized: boolean = false;

    // Cache for Tauri APIs
    private tauriFs: any = null;
    private tauriPath: any = null;

    private async getApi() {
        if (!this.tauriFs || !this.tauriPath) {
            // Hide from Vite static analysis
            const fsPkg = '@tauri-apps/api/fs';
            const pathPkg = '@tauri-apps/api/path';
            // @ts-ignore
            this.tauriFs = await import(/* @vite-ignore */ fsPkg);
            // @ts-ignore
            this.tauriPath = await import(/* @vite-ignore */ pathPkg);
        }
        return { fs: this.tauriFs, path: this.tauriPath };
    }

    hasAccess(): boolean {
        return this.isInitialized;
    }

    getRootName(): string {
        return 'HotPaste';
    }

    async requestAccess(): Promise<boolean> {
        try {
            const { fs, path } = await this.getApi();
            const docs = await path.documentDir();
            this.rootPath = await path.join(docs, 'HotPaste');
            
            const rootExists = await fs.exists(this.rootPath);
            if (!rootExists) {
                await fs.createDir(this.rootPath, { recursive: true });
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
        const { fs } = await this.getApi();

        const entries = await fs.readDir(this.rootPath, { recursive: false });
        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];
        const rootConfig = await this.readConfig('__root__');

        for (const entry of entries) {
            const name = entry.name || '';
            if (entry.children) {
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
            } else {
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

    async readFile(pathStr: string): Promise<string> {
        const fullPath = await this.resolvePath(pathStr);
        return await this.readFileInternal(fullPath);
    }

    async writeFile(pathStr: string, content: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        await fs.writeFile({ path: fullPath, contents: content });
    }

    async readConfig(tabPath: string): Promise<HotPasteConfig> {
        try {
            const { fs, path } = await this.getApi();
            const configPath = tabPath === '__root__' 
                ? await path.join(this.rootPath, CONFIG_FILENAME)
                : await path.join(this.rootPath, tabPath, CONFIG_FILENAME);
            
            if (!(await fs.exists(configPath))) return { tab: {}, cards: {}, tabs: {} };
            
            const text = await this.readFileInternal(configPath);
            const parsed = JSON.parse(text);
            const validated = HotPasteConfigSchema.safeParse(parsed);
            return validated.success ? (validated.data as HotPasteConfig) : { tab: {}, cards: {}, tabs: {} };
        } catch {
            return { tab: {}, cards: {}, tabs: {} };
        }
    }

    async writeConfig(tabPath: string, config: HotPasteConfig): Promise<void> {
        const { fs, path } = await this.getApi();
        const dirPath = tabPath === '__root__' ? this.rootPath : await path.join(this.rootPath, tabPath);
        const configPath = await path.join(dirPath, CONFIG_FILENAME);

        try {
            if (await fs.exists(configPath)) {
                const currentText = await this.readFileInternal(configPath);
                if (currentText.trim()) {
                    await fs.writeFile({ path: `${configPath}.bak`, contents: currentText });
                }
            }
        } catch {}

        await fs.writeFile({ path: configPath, contents: JSON.stringify(config, null, 2) });
    }

    async restoreFromBackup(tabPath: string): Promise<HotPasteConfig> {
        const { fs, path } = await this.getApi();
        const dirPath = tabPath === '__root__' ? this.rootPath : await path.join(this.rootPath, tabPath);
        const backupPath = await path.join(dirPath, `${CONFIG_FILENAME}.bak`);

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

    async renameFile(pathStr: string, newName: string): Promise<string> {
        const { fs } = await this.getApi();
        FileNameSchema.parse(newName);
        const oldPath = await this.resolvePath(pathStr);
        const parts = pathStr.split('/');
        parts.pop();
        const dirPath = parts.join('/');
        const newVirtualPath = dirPath === '' || dirPath === '__root__' ? newName : `${dirPath}/${newName}`;
        const newFullPath = await this.resolvePath(newVirtualPath);
        
        await fs.renameFile(oldPath, newFullPath);
        return newVirtualPath;
    }

    async deleteFile(pathStr: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        await fs.removeFile(fullPath);
    }

    async createDirectory(name: string): Promise<void> {
        const { fs, path } = await this.getApi();
        FileNameSchema.parse(name);
        const fullPath = await path.join(this.rootPath, name);
        await fs.createDir(fullPath);
    }

    async deleteDirectory(pathStr: string): Promise<void> {
        const { fs, path } = await this.getApi();
        if (pathStr === '__root__') return;
        const fullPath = await path.join(this.rootPath, pathStr);
        await fs.removeDir(fullPath, { recursive: true });
    }

    async renameDirectory(oldPathStr: string, newName: string): Promise<string> {
        const { fs, path } = await this.getApi();
        FileNameSchema.parse(newName);
        const oldFullPath = await path.join(this.rootPath, oldPathStr);
        const newFullPath = await path.join(this.rootPath, newName);
        await fs.renameFile(oldFullPath, newFullPath);
        return newName;
    }

    async copyFile(pathStr: string, newName: string): Promise<string> {
        const { fs } = await this.getApi();
        const oldPath = await this.resolvePath(pathStr);
        const parts = pathStr.split('/');
        parts.pop();
        const dirPath = parts.join('/');
        const newVirtualPath = dirPath === '' ? newName : `${dirPath}/${newName}`;
        const newFullPath = await this.resolvePath(newVirtualPath);
        
        await fs.copyFile(oldPath, newFullPath);
        return newVirtualPath;
    }

    async moveFile(pathStr: string, targetTabPath: string): Promise<string> {
        const { fs } = await this.getApi();
        const oldPath = await this.resolvePath(pathStr);
        const fileName = pathStr.split('/').pop()!;
        const newVirtualPath = targetTabPath === '__root__' ? fileName : `${targetTabPath}/${fileName}`;
        const newFullPath = await this.resolvePath(newVirtualPath);
        
        await fs.renameFile(oldPath, newFullPath);
        return newVirtualPath;
    }

    private async resolvePath(pathStr: string): Promise<string> {
        const { path } = await this.getApi();
        const normalized = pathStr.startsWith('__root__/') ? pathStr.slice(9) : pathStr;
        return await path.join(this.rootPath, normalized);
    }

    private async readFileInternal(fullPath: string): Promise<string> {
        const { fs } = await this.getApi();
        return await fs.readFile(fullPath, { dir: undefined }) as unknown as string;
    }

    private async readCardsFromDirectory(fullDirPath: string, virtualDirPath: string, config: HotPasteConfig): Promise<Card[]> {
        const { fs } = await this.getApi();
        const entries = await fs.readDir(fullDirPath);
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
