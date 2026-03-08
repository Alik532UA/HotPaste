const browser = typeof window !== 'undefined';

export abstract class CanvasEngine {
    protected canvas: HTMLCanvasElement | null = null;
    protected ctx: CanvasRenderingContext2D | null = null;
    protected width = 0;
    protected height = 0;
    protected scrollY = 0;
    protected theme: string = "dark";
    
    private animationId: number = 0;
    private lastWidth = 0;

    constructor(initialTheme: string) {
        this.theme = initialTheme;
    }

    public mount(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        
        if (browser) {
            // Initial setup
            this.width = this.canvas.clientWidth;
            this.height = this.canvas.clientHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.lastWidth = this.width;

            this.init();
            this.startLoop();
            
            window.addEventListener("resize", this.handleResizeBound);
            window.addEventListener("scroll", this.handleScrollBound);
        }
    }

    public unmount() {
        this.stopLoop();
        if (browser) {
            window.removeEventListener("resize", this.handleResizeBound);
            window.removeEventListener("scroll", this.handleScrollBound);
        }
        this.canvas = null;
        this.ctx = null;
    }

    public setTheme(theme: string) {
        this.theme = theme;
    }

    private startLoop() {
        const loop = () => {
            if (!this.canvas || !this.ctx) return;
            this.draw();
            this.animationId = requestAnimationFrame(loop);
        };
        loop();
    }

    private stopLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = 0;
        }
    }

    private handleResizeBound = () => this.handleResize();
    private handleScrollBound = () => this.handleScroll();

    private handleResize() {
        if (!this.canvas) return;

        const newWidth = this.canvas.clientWidth;
        
        // Strict check: if width hasn't changed, ignore vertical resize.
        // This prevents mobile address bar from resetting animations.
        if (newWidth === this.lastWidth) return;

        this.lastWidth = newWidth;
        this.width = newWidth;
        this.height = this.canvas.clientHeight;
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.init();
    }

    private handleScroll() {
        if (browser) {
            this.scrollY = window.scrollY;
        }
    }

    protected abstract init(): void;
    protected abstract draw(): void;

    protected getColors() {
        if (this.theme === "light") {
            return {
                primary: "rgba(0, 113, 227, ",
                secondary: "rgba(94, 92, 230, ",
            };
        }
        return {
            primary: "rgba(0, 242, 255, ",
            secondary: "rgba(112, 0, 255, ",
        };
    }
}
