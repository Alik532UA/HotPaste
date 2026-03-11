import { persistedState } from './persisted.svelte';

/** Background State — Svelte 5 Rune Class */
export type BgType = 'none' | 'particles' | 'waves' | 'floating_shapes';

class BackgroundState {
    private _type = persistedState<BgType>('hp_bg_type', 'waves');

    get current() { return this._type.value; }
    get type() { return this._type.value; }

    init() {
        // Effect-driven
    }

    set(newType: BgType) {
        console.log(`[BackgroundState] Setting background to: ${newType}`);
        this._type.value = newType;
    }

    next() {
        const types: BgType[] = ['none', 'particles', 'waves', 'floating_shapes'];
        const currentIndex = types.indexOf(this.current);
        const nextIndex = (currentIndex + 1) % types.length;
        this.set(types[nextIndex]);
    }
}

export const background = new BackgroundState();
