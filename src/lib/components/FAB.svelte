<script lang="ts">
    import { getState, startNewCardCreation } from "../stores/appState.svelte";
    import { Plus } from "lucide-svelte";

    const appState = getState();
    const isEnabled = $derived(
        appState.tabs.length > 0 && appState.isConnected,
    );

    function handleClick() {
        if (isEnabled) {
            startNewCardCreation();
        }
    }
</script>

{#if isEnabled}
    <button
        class="fab"
        onclick={handleClick}
        title="Створити нову картку (Ctrl+N)"
        aria-label="Створити нову картку"
        data-testid="fab-add-card"
    >
        <Plus size={24} strokeWidth={2.5} />
    </button>
{/if}

<style>
    .fab {
        position: fixed;
        bottom: 32px;
        right: 32px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--color-accent-gradient);
        color: var(--color-bg-primary);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow:
            0 10px 25px rgba(0, 210, 255, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        z-index: 50; /* Above cards but below modals */
        outline: none;
    }

    .fab:hover {
        transform: scale(1.1) translateY(-4px);
        box-shadow:
            0 15px 35px rgba(0, 210, 255, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    }

    .fab:active {
        transform: scale(0.95);
        transition: transform 0.1s;
    }

    .fab:focus-visible {
        box-shadow:
            0 10px 25px rgba(0, 210, 255, 0.3),
            0 0 0 2px var(--color-bg-primary),
            0 0 0 4px var(--color-accent-cyan);
    }
</style>
