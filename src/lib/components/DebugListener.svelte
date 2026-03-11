<script lang="ts">
    import { logService } from "../services/logService.svelte";
    import { dataService } from "../services/dataService";
    import { Copy, AlertCircle } from "lucide-svelte";
    import { onMount } from "svelte";

    let copied = $state(false);
    let pauseClickCount = $state(0);
    let lastPauseClick = $state(0);

    const CLEAR_THRESHOLD = import.meta.env.DEV ? 5 : 55;
    const CLICK_TIMEOUT = 1000; // Reset counter after 1s of inactivity

    // Check if there are any error logs
    const hasError = $derived(logService.entries.some(e => e.level === 'error'));

    async function handleCopy() {
        const logs = logService.getRecentLogsText();
        const header =
            `--- DEBUG LOG REPORT ---\n` +
            `Generated: ${new Date().toLocaleString()}\n` +
            `User Agent: ${navigator.userAgent}\n` +
            `------------------------\n\n`;

        try {
            await navigator.clipboard.writeText(header + logs);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch (err) {
            console.error("Помилка копіювання:", err);
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Pause" || e.key === "Break") {
            const now = Date.now();
            if (now - lastPauseClick > CLICK_TIMEOUT) {
                pauseClickCount = 1;
            } else {
                pauseClickCount++;
            }
            lastPauseClick = now;

            if (pauseClickCount >= CLEAR_THRESHOLD) {
                pauseClickCount = 0;
                dataService.clearAllData().then(() => {
                    window.location.reload();
                });
            }
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });
</script>

<div class="debug-container" data-testid="debug-container">
    {#if import.meta.env.DEV}
        <button
            class="debug-copy-btn"
            class:has-error={hasError}
            onclick={handleCopy}
            title={hasError ? "Є помилки в консолі! Натисніть щоб копіювати логи" : "Копіювати логи"}
            data-testid="btn-copy-debug-logs"
        >
            {#if hasError && !copied}
                <AlertCircle size={12} strokeWidth={2.5} />
            {:else}
                <Copy size={12} strokeWidth={2.5} />
            {/if}

            {#if copied}
                <span class="status" data-testid="debug-copy-status">OK</span>
            {/if}

            {#if pauseClickCount > 0}
                <span class="pause-counter" data-testid="pause-counter">{pauseClickCount}</span>
            {/if}
        </button>
        {/if}
        </div>

        <style>
        .debug-container {
        position: fixed;
        bottom: 32px;
        left: 32px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        }

        .debug-copy-btn {
        pointer-events: auto;
        position: relative;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--color-accent-gradient);
        color: var(--color-bg-primary);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        outline: none;
        }

        .debug-copy-btn.has-error {
        border: 2px solid var(--color-danger);
        }

        .debug-copy-btn:hover {
        transform: scale(1.05);
        }

        .debug-copy-btn:active {
        transform: scale(0.95);
        transition: transform 0.1s;
        }

        .status {
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--color-success);
        color: white;
        font-size: 8px;
        font-weight: bold;
        padding: 2px 4px;
        border-radius: 8px;
        }

        .pause-counter {
        position: absolute;
        bottom: -5px;
        right: -5px;
        font-size: 9px;
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
        padding: 1px 4px;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        min-width: 14px;
        text-align: center;
        }
        </style>
