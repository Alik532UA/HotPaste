/**
 * QWERTY Keyboard Layout mapping using physical key codes (KeyboardEvent.code).
 * This makes hotkeys layout-independent (works the same on English, Ukrainian, etc.)
 */

/** Physical codes for the first row of QWERTY keyboard */
const ROW_1 = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
/** Physical codes for the second row of QWERTY keyboard */
const ROW_2 = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];
/** Physical codes for the third row of QWERTY keyboard */
const ROW_3 = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'];

/** Full ordered list of QWERTY physical codes (26 letters total) */
export const QWERTY_CODES = [...ROW_1, ...ROW_2, ...ROW_3];

/** Tab hotkeys: physical digit codes Digit1-Digit0 */
export const TAB_CODES = [
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 
    'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'
];

/**
 * Get the physical code for a card at the given index.
 */
export function getCardHotkey(index: number): string {
    return index < QWERTY_CODES.length ? QWERTY_CODES[index] : '';
}

/**
 * Get the physical code for a tab at the given index.
 */
export function getTabHotkey(index: number): string {
    return index < TAB_CODES.length ? TAB_CODES[index] : '';
}

/**
 * Check if a code is a tab hotkey (Digit1-0).
 */
export function isTabHotkey(code: string): boolean {
    return TAB_CODES.includes(code);
}

/**
 * Check if a code is a card hotkey.
 * Allows Digit codes (if not used for tabs) or Key codes.
 */
export function isCardHotkey(code: string): boolean {
    // For cards, we allow any Key or Digit code that isn't already a tab hotkey
    return (code.startsWith('Key') || code.startsWith('Digit')) && !isTabHotkey(code);
}

/**
 * Converts a physical code (e.g., 'KeyQ', 'Digit1', 'Semicolon') 
 * into a friendly display label (e.g., 'Q', '1', ';').
 */
export function getHotkeyLabel(code: string): string {
    if (!code) return '';
    
    // KeyA -> A, Digit1 -> 1
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    
    // Special common cases
    const special: Record<string, string> = {
        'Semicolon': ';',
        'Quote': "'",
        'Comma': ',',
        'Period': '.',
        'Slash': '/',
        'Backslash': '\\',
        'BracketLeft': '[',
        'BracketRight': ']',
        'Minus': '-',
        'Equal': '=',
        'Backquote': '`',
        'Space': '␣',
        'Enter': '↵',
    };
    
    return special[code] || code;
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
