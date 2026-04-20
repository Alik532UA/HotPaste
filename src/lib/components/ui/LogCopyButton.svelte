<script lang="ts">
    import { Copy, Check } from 'lucide-svelte';
    import { logService } from '../../services/logService.svelte';
    import { fade, scale } from 'svelte/transition';

    /**
     * FAB component to copy debug logs.
     * Visibility:
     * - In DEV: Always visible.
     * - In PROD: Hidden by default, unless forceShow is true OR there are errors.
     */
    let { forceShow = false } = $props<{ forceShow?: boolean }>();

    let copied = $state(false);
    let errorCount = $derived(logService.entries.filter(e => e.level === 'error').length);
    
    // Visibility logic
    let isVisible = $derived(import.meta.env.DEV || forceShow || errorCount > 0);

    /** Fetch version with cache busting */
    async function getAppVersion(): Promise<string> {
        try {
            const res = await fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" });
            const data = await res.json();
            return data.version || 'unknown';
        } catch (e) {
            // Fallback to build-time version if fetch fails
            return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';
        }
    }

    async function handleCopy() {
        if (copied) return;

        try {
            const version = await getAppVersion();
            const header = [
                '--- REPORT from Copy LOG button ---',
                `DATE: ${new Date().toLocaleString()}`,
                `URL: ${window.location.href}`,
                `DEVICE: ${navigator.userAgent}`,
                `VERSION: ${version}`,
                '---'
            ].join('\n');

            const logs = logService.getRecentLogsText();
            const report = `${header}\n${logs}`;

            // Robust copy to clipboard
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(report);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = report;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback copy failed', err);
                }
                textArea.remove();
            }

            copied = true;
            setTimeout(() => (copied = false), 1000);
        } catch (err) {
            logService.error('LogCopyButton', `Failed to copy logs: ${err}`);
        }
    }
</script>

{#if isVisible}
    <button 
        class="log-copy-fab" 
        class:has-error={errorCount > 0} 
        class:is-copied={copied}
        onclick={handleCopy}
        transition:fade={{ duration: 200 }}
        aria-label="Copy Logs"
        title={errorCount > 0 ? `${errorCount} errors found in logs` : "Copy debug logs"}
        data-testid="log-copy-fab"
    >
        <div class="icon-wrapper">
            {#if copied}
                <div in:scale={{ duration: 200, start: 0.5 }}>
                    <Check class="fab-icon" strokeWidth={3} />
                </div>
            {:else if errorCount > 0}
                <span class="error-count" in:scale={{ duration: 200, start: 0.5 }}>
                    {errorCount > 99 ? '!!' : errorCount}
                </span>
            {:else}
                <Copy class="fab-icon" />
            {/if}
        </div>
    </button>
{/if}

<style>
    .log-copy-fab {
        position: fixed;
        bottom: 24px;
        left: 24px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--color-surface-2);
        color: var(--color-text-secondary);
        border: 1.5px solid var(--color-border);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9999;
        transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        padding: 0;
        outline: none;
    }

    .log-copy-fab:hover {
        transform: scale(1.1);
        background: var(--color-surface-3);
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
    }

    .log-copy-fab:active {
        transform: scale(0.9);
    }

    .log-copy-fab.has-error {
        background: var(--color-danger, #ff4b4b);
        border-color: rgba(255, 255, 255, 0.3);
        color: white;
        box-shadow: 0 0 10px rgba(255, 75, 75, 0.4);
    }

    .log-copy-fab.is-copied {
        background: var(--color-success, #22c55e);
        border-color: rgba(255, 255, 255, 0.3);
        color: white;
    }

    .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }

    :global(.fab-icon) {
        width: 16px;
        height: 16px;
    }

    .error-count {
        font-family: var(--font-mono, monospace);
        font-weight: 900;
        font-size: 11px;
        letter-spacing: -0.5px;
    }

    /* Animation for error state */
    .log-copy-fab.has-error:not(.is-copied) {
        animation: pulse-red 2s infinite;
    }

    @keyframes pulse-red {
        0% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0.5); }
        70% { box-shadow: 0 0 0 6px rgba(255, 75, 75, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0); }
    }

    /* Mobile adjustments */
    @media (max-width: 600px) {
        .log-copy-fab {
            bottom: 16px;
            left: 16px;
            width: 24px;
            height: 24px;
        }

        :global(.fab-icon) {
            width: 12px;
            height: 12px;
        }

        .error-count {
            font-size: 9px;
        }
    }
</style>
