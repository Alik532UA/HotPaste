/** Theme State — Svelte 5 Rune Class */
class ThemeState {
    current = $state("dark");
    isChanging = $state(false);

    init() {
        if (typeof window === 'undefined') return;
        const saved = localStorage.getItem("theme") || "dark";
        this.set(saved);
    }

    async toggle() {
        if (this.isChanging) return;
        
        this.isChanging = true;
        // Small delay to allow the blur overlay to start fading in
        await new Promise(r => setTimeout(r, 50));

        setTimeout(() => {
            const next = this.current === "dark" ? "light" : "dark";
            this.set(next);
            
            // Keep overlay active while colors transition
            setTimeout(() => {
                this.isChanging = false;
            }, 300);
        }, 200);
    }

    set(theme: string) {
        this.current = theme;
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }
}

export const theme = new ThemeState();
