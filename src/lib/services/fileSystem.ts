/**
 * File System Service — Data Layer abstraction.
 *
 * Provides an interface for file system operations that can be
 * swapped between Browser (File System Access API), Node.js, or Tauri backends.
 */

import type { Tab, Card } from '../types';
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

        // Iterate over entries in the root directory
        // @ts-ignore — entries() may not be in all TS lib definitions
        for await (const [name, handle] of this.rootHandle.entries()) {
            if (handle.kind === 'directory') {
                // Subdirectory = Tab
                const cards = await this.readCardsFromDirectory(handle as FileSystemDirectoryHandle, name);
                if (cards.length > 0) {
                    tabs.push({
                        name: this.cleanName(name),
                        hotkey: '',
                        cards,
                        path: name,
                    });
                }
            } else if (handle.kind === 'file') {
                // Root-level file = card in a default tab
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const content = await file.text();
                    rootFiles.push({
                        name: this.cleanName(name),
                        content,
                        hotkey: '',
                        filePath: name,
                        extension: ext,
                    });
                }
            }
        }

        // Sort tabs alphabetically
        tabs.sort((a, b) => a.path.localeCompare(b.path));

        // If there are root-level files, add them as the first tab
        if (rootFiles.length > 0) {
            tabs.unshift({
                name: '📄 Файли',
                hotkey: '',
                cards: rootFiles,
                path: '__root__',
            });
        }

        // Assign hotkeys to tabs
        tabs.forEach((tab, i) => {
            tab.hotkey = getTabHotkey(i);
            // Assign hotkeys to cards within each tab
            tab.cards.forEach((card, j) => {
                card.hotkey = getCardHotkey(j);
            });
        });

        return tabs;
    }

    async readFile(path: string): Promise<string> {
        if (!this.rootHandle) throw new Error('No directory access.');

        const parts = path.split('/');
        let dirHandle: FileSystemDirectoryHandle = this.rootHandle;

        // Navigate to the correct subdirectory
        for (let i = 0; i < parts.length - 1; i++) {
            dirHandle = await dirHandle.getDirectoryHandle(parts[i]);
        }

        const fileHandle = await dirHandle.getFileHandle(parts[parts.length - 1]);
        const file = await fileHandle.getFile();
        return file.text();
    }

    async writeFile(path: string, content: string): Promise<void> {
        if (!this.rootHandle) throw new Error('No directory access.');

        const parts = path.split('/');
        let dirHandle: FileSystemDirectoryHandle = this.rootHandle;

        // Navigate to the correct subdirectory
        for (let i = 0; i < parts.length - 1; i++) {
            dirHandle = await dirHandle.getDirectoryHandle(parts[i]);
        }

        const fileHandle = await dirHandle.getFileHandle(parts[parts.length - 1]);
        // @ts-ignore — createWritable may not be in all TS lib definitions
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    // --- Private helpers ---

    private async readCardsFromDirectory(
        dirHandle: FileSystemDirectoryHandle,
        dirPath: string
    ): Promise<Card[]> {
        const cards: Card[] = [];

        // @ts-ignore
        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === 'file') {
                const ext = this.getExtension(name);
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const content = await file.text();
                    cards.push({
                        name: this.cleanName(name),
                        content,
                        hotkey: '',
                        filePath: `${dirPath}/${name}`,
                        extension: ext,
                    });
                }
            }
        }

        // Sort cards alphabetically by name
        cards.sort((a, b) => a.filePath.localeCompare(b.filePath));
        return cards;
    }

    private getExtension(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
    }

    private cleanName(name: string): string {
        // Remove extension
        const lastDot = name.lastIndexOf('.');
        const withoutExt = lastDot >= 0 ? name.slice(0, lastDot) : name;
        // Remove leading numbers/underscores used for sorting (e.g., "01_General" → "General")
        return withoutExt.replace(/^\d+[_\-\s]*/, '');
    }
}
