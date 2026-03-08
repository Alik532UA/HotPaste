/** Language State — Svelte 5 Rune Class */
export type Language = 'uk' | 'en';

class LanguageState {
    current = $state<Language>('uk');
    isChanging = $state(false);

    init() {
        if (typeof window === 'undefined') return;
        const saved = localStorage.getItem('lang') as Language;
        if (saved) this.current = saved;
        document.documentElement.lang = this.current;
    }

    set(lang: Language) {
        if (this.current === lang || this.isChanging) return;
        
        this.isChanging = true;
        
        setTimeout(() => {
            this.current = lang;
            localStorage.setItem('lang', lang);
            document.documentElement.lang = lang;
            
            setTimeout(() => {
                this.isChanging = false;
            }, 100);
        }, 200);
    }
}

export const language = new LanguageState();
