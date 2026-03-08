import { persistedState } from './persisted.svelte';

class ThemeState {
    private _current = persistedState<string>("hp_theme", "dark");
    isChanging = $state(false);

    get current() { return this._current.value; }

    constructor() {
        // No $effect here to avoid effect_orphan
    }

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
        await new Promise(r => setTimeout(r, 50));

        setTimeout(() => {
            this._current.value = this.current === "dark" ? "light" : "dark";
            
            setTimeout(() => {
                this.isChanging = false;
            }, 300);
        }, 200);
    }

    set(theme: string) {
        this._current.value = theme;
    }
}

export const theme = new ThemeState();
