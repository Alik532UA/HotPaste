/** Types for the HotPaste application */

// ============================================
// Card & Tab runtime types
// ============================================

export interface Card {
  /** Unique stable identifier (defaults to filePath or temp ID for new cards) */
  id: string;
  /** Display name (from config or derived from filename) */
  name: string;
  /** Explicit display name from config (if any) */
  displayName: string | null;
  /** Full text content of the snippet */
  content: string;
  /** Assigned keyboard hotkey (QWERTY letter) */
  hotkey: string;
  /** Relative file path from root directory */
  filePath: string;
  /** Just the filename (e.g. "greeting.txt") */
  fileName: string;
  /** File extension (.txt, .md, etc.) */
  extension: string;
  /** Icon (emoji or lucide icon name) */
  icon: string | null;
  /** Card background color (CSS color or null = default) */
  color: string | null;
  /** Card border color (CSS color or null = default) */
  borderColor: string | null;
  /** Indices of strikethrough lines (0-based) */
  strikethrough: number[];
  /** File size in bytes */
  size: number;
  /** Last modified timestamp (mtime) */
  lastModified: number;
  /** Flag indicating the file was not found on disk during last scan */
  isMissing?: boolean;
  /** Internal flag for newly created unsaved cards */
  isNewMock?: boolean;
}

export interface Tab {
  /** Display name (from config or derived from folder name) */
  name: string;
  /** Explicit display name from config (if any) */
  displayName: string | null;
  /** Assigned keyboard hotkey ('1'-'9', '0') */
  hotkey: string;
  /** Cards (snippets) within this tab */
  cards: Card[];
  /** Original directory/file handle path */
  path: string;
  /** Tab icon (emoji or null) */
  icon: string | null;
  /** Tab color (CSS color or null) */
  color: string | null;
}

// ============================================
// _hotpaste.json config types (persisted)
// ============================================

export interface CardConfigEntry {
  displayName?: string | null;
  hotkey?: string | null;
  icon?: string | null;
  color?: string | null;
  borderColor?: string | null;
  strikethrough?: number[];
  /** System fingerprint for recovery (size + lastModified) */
  fingerprint?: {
    size: number;
    lastModified: number;
  };
}

export interface TabConfigEntry {
  icon?: string | null;
  color?: string | null;
  displayName?: string | null;
  /** Array of card filenames in custom order */
  order?: string[];
  /** Array of subdirectory names in custom order (only relevant for root config) */
  tabOrder?: string[];
}

export interface HotPasteConfig {
  tab?: TabConfigEntry;
  cards?: Record<string, CardConfigEntry>;
  /** Configuration for sub-tabs (only used in the root directory's config) */
  tabs?: Record<string, TabConfigEntry>;
}

/** Default empty config */
export const DEFAULT_HOTPASTE_CONFIG: HotPasteConfig = {
  tab: {},
  cards: {},
};

// ============================================
// App-level config (localStorage)
// ============================================

export interface AppConfig {
  /** Global scale factor (1.0 = default) */
  scale: number;
  /** Saved card sizes: { cardFilePath: { width, height } } */
  cardSizes: Record<string, { width: number; height: number }>;
}

export const DEFAULT_CONFIG: AppConfig = {
  scale: 1.0,
  cardSizes: {},
};

/** Config filename used in each tab directory */
export const CONFIG_FILENAME = '_hotpaste.json';

/** CSS variable for action zone width (right side of card) */
export const ACTION_ZONE_WIDTH = '80%';
