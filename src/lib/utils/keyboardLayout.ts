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
/**
 * Checks if the focus is currently within a text input element.
 * Use this to prevent hotkeys from firing when the user is typing.
 */
export function isInputFocused(): boolean {
    const activeEl = document.activeElement;
    if (!activeEl) return false;

    const tagName = activeEl.tagName.toUpperCase();
    const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName);
    const isContentEditable = (activeEl as HTMLElement).isContentEditable;
    
    // Specifically check for input types that are NOT text-related if needed,
    // but for now, we assume all INPUT should block global hotkeys.
    if (isTextInput) {
        const type = (activeEl as HTMLInputElement).type?.toLowerCase();
        // Even 'checkbox' or 'range' might be better off blocking global hotkeys 
        // to avoid accidental triggers while interacting with UI.
        return true;
    }

    return isContentEditable;
}

/**
 * Map KeyboardEvent.code or special strings to Windows VK Codes.
 * Used for the low-level keyboard hook.
 */
export function getWinVK(hotkey: string): { vk: number; alt: boolean } {
    if (hotkey === 'Win') return { vk: 0x5B, alt: false }; // VK_LWIN
    if (hotkey === 'Alt+Space') return { vk: 0x20, alt: true }; // Space with Alt
    
    let vk = 0;
    let alt = hotkey.includes('Alt+');
    const cleanKey = hotkey.replace('Alt+', '').replace('Ctrl+', '').replace('Shift+', '');

    // Common keys
    const map: Record<string, number> = {
        'Space': 0x20,
        'Enter': 0x0D,
        'Escape': 0x1B,
        'Tab': 0x09,
        'CapsLock': 0x14,
        'F1': 0x70, 'F2': 0x71, 'F3': 0x72, 'F4': 0x73, 'F5': 0x74, 'F6': 0x75,
        'F7': 0x76, 'F8': 0x77, 'F9': 0x78, 'F10': 0x79, 'F11': 0x7A, 'F12': 0x7B,
        'Insert': 0x2D, 'Delete': 0x2E, 'Home': 0x24, 'End': 0x23, 
        'PageUp': 0x21, 'PageDown': 0x22,
        'Backquote': 0xC0, // `
        'Minus': 0xBD, 'Equal': 0xBB,
        'BracketLeft': 0xDB, 'BracketRight': 0xDD, 'Backslash': 0xDC,
        'Semicolon': 0xBA, 'Quote': 0xDE,
        'Comma': 0xBC, 'Period': 0xBE, 'Slash': 0xBF,
    };

    // Letters KeyA -> 0x41
    if (cleanKey.startsWith('Key')) {
        vk = cleanKey.charCodeAt(3);
    } else if (cleanKey.startsWith('Digit')) {
        vk = cleanKey.charCodeAt(5);
    } else {
        vk = map[cleanKey] || 0;
    }

    return { vk, alt };
}

export const QWERTY_CODES = [...ROW_1, ...ROW_2, ...ROW_3];
export const CARD_CODES = QWERTY_CODES; // Alias for picker modal

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
