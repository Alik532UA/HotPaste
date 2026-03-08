<script lang="ts">
    import { logService } from "../services/logService";
    import { Copy } from "lucide-svelte";

    let copied = $state(false);

    async function handleCopy() {
        const logs = logService.getRecentLogs();
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
</script>

{#if import.meta.env.DEV}
    <button class="debug-copy-btn" onclick={handleCopy} title="Копіювати логи">
        <Copy size={16} />
        {#if copied}
            <span class="status">Скопійовано!</span>
        {/if}
    </button>
{/if}

<style>
    .debug-copy-btn {
        position: fixed;
        bottom: 32px;
        left: 32px;
        z-index: 9999;
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
</style>
