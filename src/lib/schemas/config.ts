import { z } from 'zod';

/**
 * Zod schema for single Card metadata
 */
export const CardConfigSchema = z.object({
    displayName: z.string().nullable().optional(),
    hotkey: z.string().optional(),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    borderColor: z.string().nullable().optional(),
    strikethrough: z.array(z.number()).default([])
});

/**
 * Zod schema for Tab metadata (stored in _hotpaste.json inside tab folder)
 */
export const TabConfigSchema = z.object({
    displayName: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
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
