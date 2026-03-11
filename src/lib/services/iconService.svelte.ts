import { readFile, copyFile, mkdir, exists, writeFile } from '@tauri-apps/plugin-fs';
import { documentDir, join, extname } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { getFSService } from '../stores/fileSystemState.svelte';

class IconService {
    iconCache = $state<Record<string, string>>({});

    async pickAndSaveIcon(): Promise<string | null> {
        // Check if we're in Tauri
        const isTauri = typeof window !== "undefined" && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);
        if (!isTauri) {
            // Browser fallback
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.png,.ico,.svg';
                input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return resolve(null);
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const base64 = e.target?.result as string;
                        // Use the new save method even in browser!
                        const savedPath = await this.saveBase64Icon(base64, file.name);
                        resolve(savedPath);
                    };
                    reader.readAsDataURL(file);
                };
                input.click();
            });
        }

        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Icons', extensions: ['png', 'ico', 'svg'] }]
            });
            if (!selected || typeof selected !== 'string') return null;

            const base = await documentDir();
            const iconsDir = await join(base, 'HotPaste', '.assets', 'icons');
            
            if (!(await exists(iconsDir))) {
                await mkdir(iconsDir, { recursive: true });
            }

            const ext = await extname(selected);
            const fileName = `icon_${Date.now()}.${ext}`;
            const dest = await join(iconsDir, fileName);

            await copyFile(selected, dest);

            // Return portable relative path
            return `.assets/icons/${fileName}`;
        } catch (err) {
            console.error('Failed to pick/save icon', err);
            return null;
        }
    }

    async saveBase64Icon(base64DataUrl: string, nameHint: string = 'app'): Promise<string> {
        if (!base64DataUrl.startsWith('data:')) {
            return base64DataUrl;
        }

        const isTauri = typeof window !== "undefined" && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);
        
        try {
            // Extract base64 and determine extension from mime type
            const mimeMatch = base64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
            let ext = 'png';
            if (mimeMatch && mimeMatch[1]) {
                const mime = mimeMatch[1];
                if (mime.includes('svg')) ext = 'svg';
                else if (mime.includes('x-icon') || mime.includes('vnd.microsoft.icon')) ext = 'ico';
                else if (mime.includes('jpeg')) ext = 'jpg';
                else if (mime.includes('gif')) ext = 'gif';
            }

            const base64 = base64DataUrl.split(',')[1] || base64DataUrl;
            const cleanName = nameHint.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `icon_${cleanName}_${Date.now()}.${ext}`;
            const relPath = `.assets/icons/${fileName}`;

            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            if (isTauri) {
                const base = await documentDir();
                const iconsDir = await join(base, 'HotPaste', '.assets', 'icons');
                if (!(await exists(iconsDir))) {
                    await mkdir(iconsDir, { recursive: true });
                }
                const dest = await join(iconsDir, fileName);
                await writeFile(dest, bytes);
            } else {
                // Browser mode using LocalFileSystemService
                const fsService = getFSService();
                if (fsService.hasAccess()) {
                    await fsService.createDirectory('.assets');
                    await fsService.createDirectory('.assets/icons');
                    await fsService.writeFile(`__root__/${relPath}`, bytes);
                } else {
                    return base64DataUrl; // Fallback if no FS access
                }
            }
            
            return relPath;
        } catch (err) {
            console.error('Failed to save base64 icon', err);
            return base64DataUrl;
        }
    }

    async getLocalIconUrl(relPath: string): Promise<string> {
        if (!relPath.startsWith('.assets/icons/')) return relPath;

        if (this.iconCache[relPath]) return this.iconCache[relPath];

        const isTauri = typeof window !== "undefined" && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);

        try {
            let blob: Blob;
            const ext = relPath.split('.').pop()?.toLowerCase();
            const mime = ext === 'ico' ? 'image/x-icon' : ext === 'svg' ? 'image/svg+xml' : 'image/png';

            if (isTauri) {
                const base = await documentDir();
                const fullPath = await join(base, 'HotPaste', relPath);
                const bytes = await readFile(fullPath);
                blob = new Blob([bytes], { type: mime });
            } else {
                const fsService = getFSService();
                if (fsService.hasAccess()) {
                    blob = await fsService.readFileAsBlob(`__root__/${relPath}`);
                } else {
                    return '';
                }
            }
            
            const url = URL.createObjectURL(blob);
            this.iconCache[relPath] = url;
            return url;
        } catch (err) {
            console.error('Failed to load local icon', err);
            return '';
        }
    }

    private async getBrowserFileHandle(fsService: any, relPath: string): Promise<any | null> {
        try {
            const rootHandle = fsService.rootHandle;
            if (!rootHandle) return null;
            const parts = relPath.split('/');
            let current = rootHandle;
            while (parts.length > 1) {
                current = await current.getDirectoryHandle(parts.shift()!);
            }
            return await current.getFileHandle(parts[0]);
        } catch (err) {
            return null;
        }
    }
}

export const iconService = new IconService();
