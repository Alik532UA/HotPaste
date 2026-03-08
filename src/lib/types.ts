/** Types for the HotPaste application */

export interface Card {
  /** Display name (derived from filename without extension) */
  name: string;
  /** Full text content of the snippet */
  content: string;
  /** Assigned keyboard hotkey (QWERTY letter) */
  hotkey: string;
  /** Relative file path from root directory */
  filePath: string;
  /** File extension (.txt, .md, etc.) */
  extension: string;
}

export interface Tab {
  /** Display name (derived from folder or file name) */
  name: string;
  /** Assigned keyboard hotkey ('1'-'9', '0') */
  hotkey: string;
  /** Cards (snippets) within this tab */
  cards: Card[];
  /** Original directory/file handle path */
  path: string;
}

export interface AppConfig {
  /** Global scale factor (1.0 = default) */
  scale: number;
  /** Custom hotkey overrides for tabs: { tabPath: hotkey } */
  tabHotkeys: Record<string, string>;
  /** Custom hotkey overrides for cards: { cardFilePath: hotkey } */
  cardHotkeys: Record<string, string>;
  /** Saved card sizes: { cardFilePath: { width, height } } */
  cardSizes: Record<string, { width: number; height: number }>;
}

export const DEFAULT_CONFIG: AppConfig = {
  scale: 1.0,
  tabHotkeys: {},
  cardHotkeys: {},
  cardSizes: {},
};
