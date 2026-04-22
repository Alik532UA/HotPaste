import { persistedState } from '../states/persisted.svelte';

/** Language State — Svelte 5 Rune Class */
export type Language = 'uk' | 'en';

class LanguageState {
    private _current = persistedState<Language>('hp_lang', 'uk');
    isChanging = $state(false);

    get current() { return this._current.value; }

    constructor() {
        if (typeof window !== 'undefined') {
            $effect.root(() => {
                $effect(() => {
                    document.documentElement.lang = this.current;
                });
                return () => {};
            });
        }
    }

    init() {
        // Deprecated: initialization is now handled via $effect.root in constructor
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

    toggle() {
        this.set(this.current === 'uk' ? 'en' : 'uk');
    }
}

export const language = new LanguageState();
