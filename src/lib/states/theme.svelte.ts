import { persistedState } from './persisted.svelte';

export type ThemeType = 'dark-gray' | 'light-gray' | 'orange' | 'green';

const THEMES: ThemeType[] = ['dark-gray', 'light-gray', 'orange', 'green'];

class ThemeState {
    private _current = persistedState<ThemeType>("hp_theme", "dark-gray");
    isChanging = $state(false);

    get current() { return this._current.value; }

    constructor() {}

    init() {
        $effect(() => {
            if (typeof document !== 'undefined') {
                document.documentElement.setAttribute("data-theme", this.current);
            }
        });
    }

    async toggle() {
        if (this.isChanging) return;
        
        this.isChanging = true;
        
        // Brief delay for transition overlay to show
        await new Promise(r => setTimeout(r, 50));

        const currentIndex = THEMES.indexOf(this.current);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        this._current.value = THEMES[nextIndex];
        
        // Wait for CSS transitions to finish before hiding overlay
        setTimeout(() => {
            this.isChanging = false;
        }, 400);
    }

    next() {
        return this.toggle();
    }

    set(theme: ThemeType) {
        if (THEMES.includes(theme)) {
            this._current.value = theme;
        }
    }
}

export const theme = new ThemeState();
