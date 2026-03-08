import { persistedState } from './persisted.svelte';

/** Background State — Svelte 5 Rune Class */
export type BgType = 'none' | 'particles' | 'waves' | 'mesh';

class BackgroundState {
    private _type = persistedState<BgType>('hp_bg_type', 'waves');

    get type() { return this._type.value; }

    init() {
        // Effect-driven
    }

    set(newType: BgType) {
        this._type.value = newType;
    }
}

export const background = new BackgroundState();
