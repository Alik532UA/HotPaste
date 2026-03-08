/**
 * Hotkey State — Centralized management of keyboard shortcuts and conflicts.
 */

import type { Card, Tab } from '../types';
import { logService } from '../services/logService.svelte';

/** Map of key code -> card(s) that use it in the current tab */
let keyMap = $state<Map<string, Card[]>>(new Map());

/** IDs of cards that have hotkey conflicts */
let conflictingCardIds = $derived(
    new Set(
        Array.from(keyMap.values())
            .filter(cards => cards.length > 1)
            .flatMap(cards => cards.map(c => c.id))
    )
);

export const hotkeyState = {
    get keyMap() { return keyMap; },
    get conflictingCardIds() { return conflictingCardIds; },
    
    /** Rebuild the key map for a specific list of cards */
    updateKeyMap(cards: Card[]) {
        const newMap = new Map<string, Card[]>();
        
        cards.forEach(card => {
            if (!card.hotkey) return;
            const code = card.hotkey.toLowerCase();
            if (!newMap.has(code)) {
                newMap.set(code, []);
            }
            newMap.get(code)!.push(card);
        });
        
        keyMap = newMap;
        
        // Update conflict flag on card objects for reactive UI updates
        cards.forEach(card => {
            if (card.hotkey) {
                card.isHotkeyConflicting = (keyMap.get(card.hotkey.toLowerCase())?.length ?? 0) > 1;
            } else {
                card.isHotkeyConflicting = false;
            }
        });
        
        logService.log('hotkeyState', `Key map updated. Total shortcuts: ${keyMap.size}`);
    },

    /** Check if a key has a conflict */
    hasConflict(code: string): boolean {
        return (keyMap.get(code.toLowerCase())?.length ?? 0) > 1;
    },

    /** Get cards assigned to a specific key */
    getCardsForKey(code: string): Card[] {
        return keyMap.get(code.toLowerCase()) ?? [];
    }
};
