<script lang="ts">
    import { getState } from "../stores/appState.svelte";

    const appState = getState();
</script>

{#if appState.toastVisible}
    <div class="toast" class:visible={appState.toastVisible}>
        <span class="toast-icon">✓</span>
        <span class="toast-text">{appState.toastMessage}</span>
    </div>
{/if}

<style>
    .toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        border-radius: 12px;
        background: var(--color-surface-2);
        border: 1px solid var(--color-accent-green);
        color: var(--color-accent-green);
        font-family: var(--font-family);
        font-size: 0.875rem;
        font-weight: 500;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 0 20px rgba(0, 255, 136, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }

    .toast-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0, 255, 136, 0.15);
        font-size: 0.8rem;
    }

    .toast-text {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    @keyframes slideIn {
        from {
            transform: translateY(20px) scale(0.95);
            opacity: 0;
        }
        to {
            transform: translateY(0) scale(1);
            opacity: 1;
        }
    }
</style>
