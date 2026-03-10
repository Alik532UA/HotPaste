import { z } from 'zod';

/** Maximum text file size allowed (1MB) */
export const MAX_FILE_SIZE = 1 * 1024 * 1024;

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = ['.txt', '.md'];

/**
 * Zod schema for single Card metadata
 */
export const CardConfigSchema = z.object({
    displayName: z.string().nullable().optional(),
    hotkey: z.string().optional(),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    borderColor: z.string().nullable().optional(),
    strikethrough: z.array(z.number()).default([]),
    fingerprint: z.object({
        size: z.number(),
        lastModified: z.number()
    }).optional()
});

/** Schema for file names/paths */
export const FileNameSchema = z.string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[^\\/:*?"<>|]+$/, "Invalid filename characters");

/**
 * Zod schema for virtual keyboard shortcuts
 */
export const ShortcutInfoSchema = z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['local', 'running', 'system', 'start', 'url', 'commands']).optional(),
    icon: z.string().nullable().optional()
});

/**
 * Zod schema for Tab metadata (stored in _hotpaste.json inside tab folder)
 */
export const TabConfigSchema = z.object({
    displayName: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    type: z.enum(['snippets', 'keyboard']).optional().default('snippets'),
    assignments: z.record(z.string(), ShortcutInfoSchema).optional(),
    order: z.array(z.string()).optional().default([]), // Card order inside tab
    tabOrder: z.array(z.string()).optional().default([]), // Tab order inside root
});

/**
 * Complete structure of _hotpaste.json
 */
export const HotPasteConfigSchema = z.object({
    tab: TabConfigSchema.partial().optional().default({}),
    cards: z.record(z.string(), CardConfigSchema.partial()).optional().default({}),
    tabs: z.record(z.string(), TabConfigSchema.partial()).optional().default({})
});

export type ValidatedHotPasteConfig = z.infer<typeof HotPasteConfigSchema>;
export type ValidatedCardConfig = z.infer<typeof CardConfigSchema>;
export type ValidatedTabConfig = z.infer<typeof TabConfigSchema>;
