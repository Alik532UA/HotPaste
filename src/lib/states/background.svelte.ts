/** Background State — Svelte 5 Rune Class */
export type BgType = 'none' | 'particles' | 'waves' | 'mesh';

class BackgroundState {
    type = $state<BgType>('none');

    init() {
        if (typeof window === 'undefined') return;
        this.type = (localStorage.getItem('hp_bg_type') as BgType) || 'waves';
    }

    set(newType: BgType) {
        if (this.type === newType) return;
        this.type = newType;
        localStorage.setItem('hp_bg_type', newType);
    }
}

export const background = new BackgroundState();
