/**
 * QWERTY Keyboard Layout mapping for card hotkeys.
 * Cards are assigned letters based on their visual position,
 * mapping to standard keyboard rows.
 */

/** First row of QWERTY keyboard */
const ROW_1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
/** Second row of QWERTY keyboard */
const ROW_2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
/** Third row of QWERTY keyboard */
const ROW_3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

/** Full ordered list of QWERTY hotkeys (26 letters total) */
export const QWERTY_KEYS = [...ROW_1, ...ROW_2, ...ROW_3];

/** Tab hotkeys: digits 1-9 and 0 for the 10th tab */
export const TAB_HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * Get the QWERTY hotkey for a card at the given index.
 * Returns empty string if index exceeds available keys (26).
 */
export function getCardHotkey(index: number): string {
    return index < QWERTY_KEYS.length ? QWERTY_KEYS[index] : '';
}

/**
 * Get the tab hotkey for a tab at the given index.
 * Returns empty string if index exceeds 10 tabs.
 */
export function getTabHotkey(index: number): string {
    return index < TAB_HOTKEYS.length ? TAB_HOTKEYS[index] : '';
}

/**
 * Check if a key is a tab hotkey (digit).
 */
export function isTabHotkey(key: string): boolean {
    return TAB_HOTKEYS.includes(key);
}

/**
 * Check if a key is a card hotkey (QWERTY letter).
 */
export function isCardHotkey(key: string): boolean {
    return QWERTY_KEYS.includes(key.toLowerCase());
}

/**
 * Get the visual keyboard row info for display purposes.
 */
export function getKeyboardRows() {
    return [
        { keys: ROW_1, label: 'Row 1' },
        { keys: ROW_2, label: 'Row 2' },
        { keys: ROW_3, label: 'Row 3' },
    ];
}
