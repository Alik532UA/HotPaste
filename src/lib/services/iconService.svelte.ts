import { readFile, copyFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { documentDir, join, extname } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';

class IconService {
    iconCache = $state<Record<string, string>>({});

    async pickAndSaveIcon(): Promise<string | null> {
        // Check if we're in Tauri
        const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
        if (!isTauri) {
            console.warn("Icon upload is only supported in desktop app");
            return null;
        }

        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Icons', extensions: ['png', 'ico', 'svg'] }]
            });
            if (!selected || typeof selected !== 'string') return null;

            const base = await documentDir();
            const iconsDir = await join(base, 'HotPaste', '.private', 'icons');
            
            if (!(await exists(iconsDir))) {
                await mkdir(iconsDir, { recursive: true });
            }

            const ext = await extname(selected);
            const fileName = `icon_${Date.now()}.${ext}`;
            const dest = await join(iconsDir, fileName);

            await copyFile(selected, dest);

            // Return portable relative path
            return `.private/icons/${fileName}`;
        } catch (err) {
            console.error('Failed to pick/save icon', err);
            return null;
        }
    }

    async getLocalIconUrl(relPath: string): Promise<string> {
        // Check if we're in Tauri
        const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
        if (!isTauri || !relPath.startsWith('.private/icons/')) return relPath;

        if (this.iconCache[relPath]) return this.iconCache[relPath];

        try {
            const base = await documentDir();
            const fullPath = await join(base, 'HotPaste', relPath);
            const bytes = await readFile(fullPath);
            
            const ext = relPath.split('.').pop()?.toLowerCase();
            const mime = ext === 'ico' ? 'image/x-icon' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
            
            const blob = new Blob([bytes], { type: mime });
            const url = URL.createObjectURL(blob);
            
            this.iconCache[relPath] = url;
            return url;
        } catch (err) {
            console.error('Failed to load local icon', err);
            return '';
        }
    }
}

export const iconService = new IconService();
