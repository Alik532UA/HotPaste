<script lang="ts">
    import { Copy, Check } from 'lucide-svelte';
    import { logService } from '../../services/logService.svelte';
    import { debugMode } from '../../services/debugMode.svelte';
    import { fade, scale } from 'svelte/transition';

    /**
     * Service badge / Log Copy button for HotPaste (DEBUGGING-v10 § 2).
     * Visibility:
     * - In DEV: Always visible (carrying version number).
     * - In PROD: Hidden by default, visible on ?debug=1, debugMode (localStorage), or 55x KeyV.
     */
    let copied = $state(false);
    let fallbackReport = $state<string | null>(null);
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    const errorCount = $derived(logService.errorCount);
    const appVersion = $derived(logService.appVersion);

    const urlDebug = $derived(
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('debug') === '1'
    );
    const isVisible = $derived(urlDebug || debugMode.enabled);

    async function handleCopy() {
        const report = logService.getReport();
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(report);
            } else {
                throw new Error('Clipboard API unavailable in this context');
            }
            fallbackReport = null;
            copied = true;
            if (copyTimer) clearTimeout(copyTimer);
            copyTimer = setTimeout(() => (copied = false), 1500);
        } catch (err) {
            logService.warn('LogCopyButton', 'Failed to copy logs to clipboard', err);
            fallbackReport = report;
        }
    }
</script>

{#if fallbackReport}
    <textarea
        class="log-fallback"
        readonly
        value={fallbackReport}
        aria-label="Debug report fallback"
        data-testid="debug-log-fallback-input"
    ></textarea>
{/if}

{#if isVisible}
    <button 
        type="button"
        class="log-copy-fab" 
        class:has-error={errorCount > 0} 
        class:is-copied={copied}
        onclick={handleCopy}
        transition:fade={{ duration: 200 }}
        aria-label="Copy debug report — {appVersion}"
        data-testid="app-version-value"
    >
        {#if copied}
            <Check class="fab-icon" size={14} />
        {:else if errorCount > 0}
            <span class="error-count">{errorCount > 99 ? '99+' : errorCount}</span>
        {:else}
            <Copy class="fab-icon" size={12} />
        {/if}
        <span class="version">{appVersion}</span>
    </button>
{/if}

<style>
    .log-copy-fab {
        position: fixed;
        bottom: 24px;
        left: 24px;
        min-height: 32px;
        padding: 0 10px;
        border-radius: 16px;
        background: var(--color-surface-2, #242424);
        color: var(--color-text-secondary, #cccccc);
        border: 1.5px solid var(--color-border, #444444);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        z-index: 9999;
        transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        font-family: inherit;
        outline: none;
    }

    .log-copy-fab:hover {
        transform: scale(1.05);
        background: var(--color-surface-3, #333333);
        color: var(--color-text-primary, #ffffff);
    }

    .log-copy-fab.has-error {
        background: #c92a2a;
        border-color: #7f1d1d;
        color: #ffffff;
    }

    .log-copy-fab.is-copied {
        background: #237a35;
        border-color: #1b5e20;
        color: #ffffff;
    }

    .error-count {
        font-family: monospace;
        font-weight: 800;
        font-size: 10px;
        padding: 2px 5px;
        border-radius: 8px;
        background: #7f1d1d;
        color: white;
    }

    .version {
        font-family: monospace;
        font-size: 11px;
        line-height: 1;
        white-space: nowrap;
    }

    .log-fallback {
        position: fixed;
        bottom: 76px;
        left: 24px;
        width: min(38rem, calc(100vw - 48px));
        height: min(40dvh, 20rem);
        z-index: 9999;
        padding: 8px;
        font-family: monospace;
        font-size: 0.75rem;
        background: #1e1e1e;
        color: #ffffff;
        border: 2px solid #ef4444;
        border-radius: 8px;
        resize: none;
    }

    @media (hover: none) {
        .log-copy-fab {
            min-height: 44px;
            padding: 0 14px;
            border-radius: 22px;
        }

        .version {
            font-size: 12px;
        }
    }
</style>
