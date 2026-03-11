import { tick } from "svelte";

/**
 * AdaptiveHeader Controller
 * Manages the smart collapsing of header elements based on available space.
 */
class AdaptiveHeader {
  // Config
  private readonly COLLAPSE_ORDER = ['background', 'language', 'theme', 'density', 'view'] as const;
  private readonly MIN_GAP = 24;

  // State
  private _collapsedStates = $state<Record<string, boolean>>({
    background: false,
    language: false,
    theme: false,
    density: false,
    view: false
  });

  private _isUpdating = false;
  private _lastWidth = 0;

  // Refs (passed from component)
  private _container: HTMLElement | null = null;
  private _left: HTMLElement | null = null;
  private _right: HTMLElement | null = null;

  constructor() {}

  /**
   * Initialize with DOM references
   */
  init(container: HTMLElement, left: HTMLElement, right: HTMLElement) {
    this._container = container;
    this._left = left;
    this._right = right;
    
    const observer = new ResizeObserver(() => this.update());
    observer.observe(container);
    return () => observer.disconnect();
  }

  /**
   * Current collapsed states
   */
  get collapsed() {
    return this._collapsedStates;
  }

  /**
   * Main update logic
   */
  async update(force = false) {
    if (!this._container || !this._left || !this._right || this._isUpdating) return;

    const currentWidth = this._container.getBoundingClientRect().width;
    if (currentWidth === 0) return;

    // Small changes don't trigger update unless forced
    if (!force && Math.abs(currentWidth - this._lastWidth) < 5) return;

    const isExpanding = currentWidth > this._lastWidth;
    this._lastWidth = currentWidth;
    this._isUpdating = true;

    try {
      if (isExpanding) {
        // Reset all to full mode to measure their "ideal" size
        for (const key of this.COLLAPSE_ORDER) {
          this._collapsedStates[key] = false;
        }
        await tick();
        // Wait for potential CSS transitions
        await new Promise(r => requestAnimationFrame(r));
      }

      // Sequentially collapse elements from right to left (as they appear in COLLAPSE_ORDER)
      // Note: order is background, language, theme, density, view
      for (const key of this.COLLAPSE_ORDER) {
        // Measure current desired space
        // scrollWidth of left side (logo + root name) + right side (controls)
        const leftWidth = this._left.scrollWidth;
        const rightWidth = this._right.scrollWidth;
        const totalDesired = leftWidth + rightWidth + this.MIN_GAP;

        if (totalDesired > currentWidth) {
          if (!this._collapsedStates[key]) {
            this._collapsedStates[key] = true;
            await tick();
            await new Promise(r => requestAnimationFrame(r));
          }
        } else {
          // If it fits and we are not expanding, we can stop early
          if (!isExpanding) break;
        }
      }
    } finally {
      this._isUpdating = false;
    }
  }
}

export const adaptiveHeader = new AdaptiveHeader();
