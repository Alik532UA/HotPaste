<script lang="ts">
    import { logService } from "../services/logService.svelte";
    import { dataService } from "../services/dataService";
    import { Copy } from "lucide-svelte";
    import { onMount } from "svelte";

    let copied = $state(false);
    let pauseClickCount = $state(0);
    let lastPauseClick = $state(0);

    const CLEAR_THRESHOLD = import.meta.env.DEV ? 5 : 55;
    const CLICK_TIMEOUT = 1000; // Reset counter after 1s of inactivity

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
        // "Pause" is the standard key name for the Pause/Break key
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
                dataService.clearAllData();
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
        <button class="debug-copy-btn" onclick={handleCopy} title="Копіювати логи" data-testid="btn-copy-debug-logs">
            <Copy size={16} />
            {#if copied}
                <span class="status" data-testid="debug-copy-status">Скопійовано!</span>
            {/if}
            {#if pauseClickCount > 0}
                <span class="pause-counter" data-testid="pause-counter">{pauseClickCount}/{CLEAR_THRESHOLD}</span>
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
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        cursor: pointer;
        font-family: var(--font-family, sans-serif);
        transition: all 0.2s;
    }

    .debug-copy-btn:hover {
        background: rgba(0, 0, 0, 0.9);
        transform: scale(1.05);
    }

    .status {
        font-size: 12px;
        font-weight: bold;
    }

    .pause-counter {
        font-size: 10px;
        background: var(--color-accent-violet);
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 30px;
        text-align: center;
    }
</style>
