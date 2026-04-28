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
  /** Relative path of the subfolder this card belongs to (null if in root of tab) */
  subfolder: string | null;
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
  /** Whether the hotkey was explicitly set by user in config */
  isCustomHotkey?: boolean;
  /** Whether this card's hotkey conflicts with another card in the same tab */
  isHotkeyConflicting?: boolean;
  /** Flag indicating the file was not found on disk during last scan */
  isMissing?: boolean;
  /** Internal flag for newly created unsaved cards */
  isNewMock?: boolean;
  /** Number of presses required to confirm action (1 = instant) */
  confirmCount?: number;
}

export type TabType = 'snippets' | 'keyboard';

export interface ShortcutInfo {
  name: string;
  path: string;
  type?: 'local' | 'running' | 'system' | 'url' | 'start' | 'commands';
  icon?: string | null;
  displayMode?: 'icon' | 'text' | 'both' | 'none';
  customLabel?: string;
  /** Number of presses required to confirm action (1 = instant) */
  confirmCount?: number;
}

export interface KeyboardLayoutSettings {
  f1_f12?: boolean;
  f13_f24?: boolean;
  num_lock?: boolean;
  navigation_pane?: boolean;
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
  /** List of relative subfolder paths found in this tab */
  subfolders: string[];
  /** Original directory/file handle path */
  path: string;
  /** Tab icon (emoji or null) */
  icon: string | null;
  /** Tab color (CSS color or null) */
  color: string | null;
  /** Tab mode (default: snippets) */
  type: TabType;
  /** Virtual keyboard assignments (if type is keyboard) */
  assignments?: Record<string, ShortcutInfo>;
  /** Keyboard modular layout settings */
  keyboardLayout?: KeyboardLayoutSettings;
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
  type?: TabType;
  assignments?: Record<string, ShortcutInfo>;
  /** Array of card filenames in custom order */
  order?: string[];
  /** Array of subdirectory names in custom order (only relevant for root config) */
  tabOrder?: string[];
  /** Keyboard modular layout settings */
  keyboardLayout?: KeyboardLayoutSettings;
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
  /** Default display mode for Snippets tabs */
  defaultModeSnippets: 'full' | 'minimal';
  /** Default display mode for Keyboard tabs */
  defaultModeKeyboard: 'full' | 'minimal';
  /** Mode toggle hotkey: [Space] and [F11], only [Space], or only [F11] */
  toggleModeHotkey: 'space_f11' | 'space' | 'f11';
  /** Whether the app should start on Windows startup */
  autostartEnabled: boolean;
  /** Global hotkey to show/hide the app (e.g. "Win", "Alt+Space", "F1") */
  triggerKey: string;
  /** Primary font family for the interface */
  fontFamily: string;
  /** Font family for Markdown snippets */
  fontMd: string;
  /** Font family for Plain Text snippets */
  fontTxt: string;
  /** Font family for hotkey badges and buttons */
  fontHotkey: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  scale: 1.0,
  cardSizes: {},
  defaultModeSnippets: 'full',
  defaultModeKeyboard: 'minimal',
  toggleModeHotkey: 'space',
  autostartEnabled: true,
  triggerKey: 'Win',
  fontFamily: 'e-Ukraine',
  fontMd: 'Arsenal',
  fontTxt: 'IBM Plex Mono',
  fontHotkey: 'Cascadia Mono',
};

/** Config filename used in each tab directory */
export const CONFIG_FILENAME = '_hotpaste.json';

/** CSS variable for action zone width (right side of card) */
export const ACTION_ZONE_WIDTH = '80%';
