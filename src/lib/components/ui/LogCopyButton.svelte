<script lang="ts">
    import { Copy, Check, AlertTriangle } from 'lucide-svelte';
    import { logService } from '../../services/logService.svelte';
    import { fade } from 'svelte/transition';
    import { versionStore } from '../../stores/versionStore.svelte';

    let { forceShow = false } = $props<{ forceShow?: boolean }>();

    let copied = $state(false);
    let errorCount = $derived(logService.entries.filter(e => e.level === 'error').length);

    // Show button if: 
    // 1. We are in dev mode OR
    // 2. forceShow is true OR
    // 3. There are errors
    let isVisible = $derived(import.meta.env.DEV || forceShow || errorCount > 0);

    async function copyLogs() {
        try {
            const nav = window.navigator as any;
            let deviceStr = nav.userAgent || 'unknown';

            const header = [
                '--- REPORT from Copy LOG button ---',
                `DATE: ${new Date().toLocaleString()}`,
                `URL: ${window.location.href}`,
                `DEVICE: ${deviceStr}`,
                `VERSION: ${versionStore.serverVersion || 'unknown'}`,
                '---'
            ].join('\n');

            const fullText = header + '\n' + logService.getRecentLogsText();

            if (navigator.clipboard) {
                await navigator.clipboard.writeText(fullText);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = fullText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            copied = true;
            setTimeout(() => copied = false, 1000);
        } catch (e) {
            logService.error('LogCopyButton', `Failed to copy logs: ${e}`);
        }
    }
</script>

{#if isVisible}
    <button 
        class="log-copy-fab" 
        class:has-error={errorCount > 0} 
        class:copied={copied}
        onclick={copyLogs}
        transition:fade={{ duration: 150 }}
        title="Copy App Logs"
        data-testid="log-copy-fab"
    >
        {#if copied}
            <Check size={20} class="icon check" />
        {:else if errorCount > 0}
            <span class="error-badge">{errorCount}</span>
        {:else}
            <Copy size={20} class="icon" />
        {/if}
    </button>
{/if}

<style>
    .log-copy-fab {
        position: fixed;
        bottom: 24px;
        right: 24px; /* Default placement */
        width: 48px;
        height: 48px;
        border-radius: 24px;
        background: var(--color-surface-2);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 9999;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .log-copy-fab:hover {
        background: var(--color-surface-3);
        color: var(--color-text-primary);
        transform: scale(1.05);
    }

    .log-copy-fab.copied {
        background: var(--color-success);
        border-color: var(--color-success);
        color: #fff;
    }

    .log-copy-fab.has-error:not(.copied) {
        background: var(--color-error);
        border-color: var(--color-error);
        color: #fff;
        animation: pulse 2s infinite;
    }

    .error-badge {
        font-weight: 800;
        font-size: 14px;
        font-family: var(--font-mono);
    }

    :global(.log-copy-fab .icon) {
        transition: transform 0.2s;
    }

    .log-copy-fab:active {
        transform: scale(0.95);
    }

    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(255, 75, 75, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0); }
    }

    /* Make sure it doesn't overlap with the main app FAB if present */
    @media (max-width: 768px) {
        .log-copy-fab {
            top: 16px; /* Move to top on mobile so it doesn't collide with bottom navigation/FABs */
            bottom: auto;
            right: 16px;
        }
    }
</style>
