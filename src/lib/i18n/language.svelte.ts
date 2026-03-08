import { persistedState } from '../states/persisted.svelte';

/** Language State — Svelte 5 Rune Class */
export type Language = 'uk' | 'en';

class LanguageState {
    private _current = persistedState<Language>('hp_lang', 'uk');
    isChanging = $state(false);

    get current() { return this._current.value; }

    constructor() {
        // No $effect here to avoid effect_orphan
    }

    init() {
        $effect(() => {
            if (typeof document !== 'undefined') {
                document.documentElement.lang = this.current;
            }
        });
    }

    set(lang: Language) {
        if (this.current === lang || this.isChanging) return;
        
        this.isChanging = true;
        
        setTimeout(() => {
            this._current.value = lang;
            
            setTimeout(() => {
                this.isChanging = false;
            }, 100);
        }, 200);
    }
}

export const language = new LanguageState();
