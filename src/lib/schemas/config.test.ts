import { describe, it, expect } from 'vitest';
import { FileNameSchema, HotPasteConfigSchema } from './config';

describe('FileNameSchema', () => {
    it('should validate correct filenames', () => {
        expect(FileNameSchema.safeParse('my_file.txt').success).toBe(true);
        expect(FileNameSchema.safeParse('Сніпет 123.md').success).toBe(true);
        expect(FileNameSchema.safeParse('config-backup').success).toBe(true);
    });

    it('should fail on invalid characters', () => {
        expect(FileNameSchema.safeParse('file/path.txt').success).toBe(false);
        expect(FileNameSchema.safeParse('name:invalid').success).toBe(false);
        expect(FileNameSchema.safeParse('test?*').success).toBe(false);
        expect(FileNameSchema.safeParse('   ').success).toBe(false); // Min length 1
    });
});

describe('HotPasteConfigSchema', () => {
    it('should validate minimal valid config', () => {
        const config = { tab: {}, cards: {}, tabs: {} };
        expect(HotPasteConfigSchema.safeParse(config).success).toBe(true);
    });

    it('should validate complex card metadata', () => {
        const config = {
            cards: {
                "test.txt": {
                    displayName: "My Test",
                    hotkey: "KeyA",
                    strikethrough: [1, 2, 3]
                }
            }
        };
        const result = HotPasteConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.cards?.["test.txt"]?.strikethrough).toEqual([1, 2, 3]);
        }
    });

    it('should handle partial metadata', () => {
        const config = {
            cards: {
                "minimal.txt": {}
            }
        };
        expect(HotPasteConfigSchema.safeParse(config).success).toBe(true);
    });
});
