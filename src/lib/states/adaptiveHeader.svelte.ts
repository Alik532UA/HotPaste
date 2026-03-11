import { tick } from "svelte";
import { logService } from "../services/logService.svelte";

/**
 * AdaptiveHeader Controller — Deterministic Stateless Adaptive Logic
 */
class AdaptiveHeader {
    // Sequence of collapsing (from first to last)
    private readonly COLLAPSE_ORDER = ['bg-type', 'lang', 'theme', 'density', 'view'] as const;

    // Minimum width for left side to prevent logo/divider overlap
    private readonly MIN_LEFT_WIDTH = 200;
    private readonly CONTAINER_GAP = 24;
    private readonly ITEM_GAP = 12; // Gap between items in header-right (from CSS)

    // State
    private _collapsedStates = $state<Record<string, boolean>>({
        'bg-type': false,
        'lang': false,
        'theme': false,
        'density': false,
        'view': false
    });

    private _isProcessing = false;
    private _container: HTMLElement | null = null;
    private _left: HTMLElement | null = null;
    private _right: HTMLElement | null = null;
    private _lastWidth = 0;

    constructor() { }

    init(container: HTMLElement, left: HTMLElement, right: HTMLElement) {
        // Reset processing lock on re-init (e.g., when $effect re-runs)
        this._isProcessing = false;

        this._container = container;
        this._left = left;
        this._right = right;

        logService.info('header', 'AdaptiveHeader.init()', {
            containerWidth: container.clientWidth,
            rightChildren: right.children.length,
        });

        // 1. ResizeObserver with threshold to prevent jitter
        const resizeObserver = new ResizeObserver((entries) => {
            const width = Math.floor(entries[0].contentRect.width);
            if (Math.abs(this._lastWidth - width) > 1) {
                this._lastWidth = width;
                requestAnimationFrame(() => this.update());
            }
        });

        if (container) resizeObserver.observe(container);

        // 2. MutationObserver for content changes
        const mutationObserver = new MutationObserver(() => {
            this.update();
        });

        const config = { childList: true, subtree: true, characterData: true };
        if (left) mutationObserver.observe(left, config);
        if (right) mutationObserver.observe(right, config);

        // 3. Robust Cold Start Sequence
        const forceUpdate = () => this.update();

        requestAnimationFrame(forceUpdate);
        const timers = [
            setTimeout(forceUpdate, 50),
            setTimeout(forceUpdate, 200),
            setTimeout(forceUpdate, 600),
            setTimeout(forceUpdate, 1500),
            setTimeout(forceUpdate, 3000)
        ];

        if (typeof document !== 'undefined' && (document as any).fonts) {
            (document as any).fonts.ready.then(forceUpdate);
        }

        return () => {
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            timers.forEach(clearTimeout);
        };
    }

    get collapsed() {
        return this._collapsedStates;
    }

    /**
     * Deterministic update logic — avoids infinite loops by simulating width before applying state
     */
    public async update() {
        if (!this._container || !this._right || this._isProcessing) return;

        const containerWidth = Math.floor(this._container.clientWidth);
        if (containerWidth === 0) return;

        this._isProcessing = true;

        try {
            // How much space we have for the right side
            const availableSpace = containerWidth - this.MIN_LEFT_WIDTH - this.CONTAINER_GAP;

            // 1. Map children to dimensions (stateless measurement)
            const children = Array.from(this._right.children) as HTMLElement[];
            const measurements: Record<string, { full: number, compact: number }> = {};
            let fixedWidth = 0;
            let collapsibleKeys: string[] = [];

            children.forEach((child) => {
                const testId = child.getAttribute('data-testid') || '';
                const key = this.COLLAPSE_ORDER.find(k => testId.includes(k));

                if (key) {
                    const fullEl = child.querySelector('.view-full');
                    const compactEl = child.querySelector('.view-compact');

                    measurements[key] = {
                        full: fullEl ? (fullEl as HTMLElement).scrollWidth : child.scrollWidth,
                        compact: compactEl ? (compactEl as HTMLElement).scrollWidth : child.scrollWidth
                    };
                    collapsibleKeys.push(key);
                } else {
                    fixedWidth += child.scrollWidth;
                }
            });

            // 2. Simulate optimal state
            // We start with all elements expanded
            const nextStates: Record<string, boolean> = {};
            this.COLLAPSE_ORDER.forEach(k => nextStates[k] = false);

            const calculateTotalWidth = (states: Record<string, boolean>) => {
                let total = fixedWidth;
                let visibleCount = children.length;

                // Add widths based on simulated state
                collapsibleKeys.forEach(k => {
                    total += states[k] ? measurements[k].compact : measurements[k].full;
                });

                // Add gaps
                if (visibleCount > 1) {
                    total += (visibleCount - 1) * this.ITEM_GAP;
                }
                return Math.ceil(total);
            };

            // Iteratively collapse based on COLLAPSE_ORDER until fits
            const TOLERANCE = 5;
            for (const key of this.COLLAPSE_ORDER) {
                if (calculateTotalWidth(nextStates) <= availableSpace) break;
                nextStates[key] = true;
            }

            // 3. Apply state only if changed
            let hasChanged = false;
            for (const key of this.COLLAPSE_ORDER) {
                if (this._collapsedStates[key] !== nextStates[key]) {
                    this._collapsedStates[key] = nextStates[key];
                    hasChanged = true;
                }
            }

            if (hasChanged) {
                const currentWidth = calculateTotalWidth(nextStates);
                logService.info('header', `Layout adjusted: ${currentWidth}px / ${availableSpace}px`, nextStates);
                await tick(); // Let Svelte update DOM
            }

        } finally {
            if (this._container) {
                this._lastWidth = Math.floor(this._container.clientWidth);
            }
            this._isProcessing = false;
        }
    }
}

export const adaptiveHeader = new AdaptiveHeader();
//