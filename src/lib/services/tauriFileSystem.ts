/**
 * Tauri 2.0 File System Service implementation.
 * Uses @tauri-apps/plugin-fs and @tauri-apps/api/path.
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
            // Standard dynamic imports allow Vite to bundle these properly
            this.tauriFs = await import('@tauri-apps/plugin-fs');
            this.tauriPath = await import('@tauri-apps/api/path');
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
        logService.log('fileSystem', 'Tauri requestAccess starting...');
        try {
            const { fs, path } = await this.getApi();
            logService.log('fileSystem', 'Tauri API acquired');

            const docs = await path.documentDir();
            logService.log('fileSystem', `Tauri documents dir: ${docs}`);

            this.rootPath = await path.join(docs, 'HotPaste');
            logService.log('fileSystem', `Tauri target root path: ${this.rootPath}`);
            
            const rootExists = await fs.exists(this.rootPath);
            logService.log('fileSystem', `Tauri root exists: ${rootExists}`);

            if (!rootExists) {
                logService.log('fileSystem', 'Tauri creating root directory...');
                await fs.mkdir(this.rootPath, { recursive: true });
                logService.log('fileSystem', 'Tauri root directory created');
            }
            
            this.isInitialized = true;
            logService.log('fileSystem', `Tauri root initialized at: ${this.rootPath}`);
            return true;
        } catch (err) {
            logService.error('fileSystem', 'Tauri access failed with error:', err);
            return false;
        }
    }

    async readDirectory(): Promise<Tab[]> {
        if (!this.isInitialized) throw new Error('Not initialized');
        const { fs } = await this.getApi();

        const entries = await fs.readDir(this.rootPath);
        const tabs: Tab[] = [];
        const rootFiles: Card[] = [];
        const rootConfig = await this.readConfig('__root__');

        for (const entry of entries) {
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
                    });
                }
            } else if (entry.isFile) {
                const ext = this.getExtension(name);
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
        return await this.readFileInternal(pathStr);
    }

    async writeFile(pathStr: string, content: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        await fs.writeTextFile(fullPath, content);
    }

    async readConfig(tabPath: string): Promise<HotPasteConfig> {
        try {
            const { fs, path } = await this.getApi();
            const configPath = tabPath === '__root__' 
                ? await path.join(this.rootPath, CONFIG_FILENAME)
                : await path.join(this.rootPath, tabPath, CONFIG_FILENAME);
            
            if (!(await fs.exists(configPath))) return { tab: {}, cards: {}, tabs: {} };
            
            const text = await this.readFileInternalByFullPath(configPath);
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
                const currentText = await this.readFileInternalByFullPath(configPath);
                if (currentText.trim()) {
                    await fs.writeTextFile(`${configPath}.bak`, currentText);
                }
            }
        } catch {}

        await fs.writeTextFile(configPath, JSON.stringify(config, null, 2));
    }

    async restoreFromBackup(tabPath: string): Promise<HotPasteConfig> {
        const { fs, path } = await this.getApi();
        const dirPath = tabPath === '__root__' ? this.rootPath : await path.join(this.rootPath, tabPath);
        const backupPath = await path.join(dirPath, `${CONFIG_FILENAME}.bak`);

        try {
            const text = await this.readFileInternalByFullPath(backupPath);
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
        
        await fs.rename(oldPath, newFullPath);
        return newVirtualPath;
    }

    async deleteFile(pathStr: string): Promise<void> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        await fs.remove(fullPath);
    }

    async createDirectory(name: string): Promise<void> {
        const { fs, path } = await this.getApi();
        FileNameSchema.parse(name);
        const fullPath = await path.join(this.rootPath, name);
        await fs.mkdir(fullPath);
    }

    async deleteDirectory(pathStr: string): Promise<void> {
        const { fs, path } = await this.getApi();
        if (pathStr === '__root__') return;
        const fullPath = await path.join(this.rootPath, pathStr);
        await fs.remove(fullPath, { recursive: true });
    }

    async renameDirectory(oldPathStr: string, newName: string): Promise<string> {
        const { fs, path } = await this.getApi();
        FileNameSchema.parse(newName);
        const oldFullPath = await path.join(this.rootPath, oldPathStr);
        const newFullPath = await path.join(this.rootPath, newName);
        await fs.rename(oldFullPath, newFullPath);
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
        
        await fs.rename(oldPath, newFullPath);
        return newVirtualPath;
    }

    private async resolvePath(pathStr: string): Promise<string> {
        const { path } = await this.getApi();
        const normalized = pathStr.startsWith('__root__/') ? pathStr.slice(9) : pathStr;
        return await path.join(this.rootPath, normalized);
    }

    private async readFileInternal(pathStr: string): Promise<string> {
        const { fs } = await this.getApi();
        const fullPath = await this.resolvePath(pathStr);
        return await fs.readTextFile(fullPath);
    }

    private async readFileInternalByFullPath(fullPath: string): Promise<string> {
        const { fs } = await this.getApi();
        return await fs.readTextFile(fullPath);
    }

    private async readCardsFromDirectory(virtualDirPath: string, config: HotPasteConfig): Promise<Card[]> {
        const { fs, path } = await this.getApi();
        const fullDirPath = await path.join(this.rootPath, virtualDirPath);
        const entries = await fs.readDir(fullDirPath);
        const cards: Card[] = [];

        for (const entry of entries) {
            const name = entry.name || '';
            if (entry.isFile && name !== CONFIG_FILENAME) {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const content = await this.readFileInternal(`${virtualDirPath}/${name}`);
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
