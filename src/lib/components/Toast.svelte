<script lang="ts">
    import { getState } from "../stores/appState.svelte";

    const appState = getState();
</script>

{#if appState.toastVisible}
    <div class="toast" class:visible={appState.toastVisible} data-testid="toast-notification">
        <span class="toast-icon" data-testid="toast-icon">✓</span>
        <span class="toast-text" data-testid="toast-text">{appState.toastMessage}</span>
    </div>
{/if}

<style>
    .toast {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 32px 56px;
        border-radius: 24px;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-success);
        color: var(--color-text-primary);
        font-family: var(--font-family);
        font-size: 1.25rem;
        font-weight: 700;
        box-shadow: var(--shadow-lg), 0 0 40px color-mix(in srgb, var(--color-success) 20%, transparent);
        z-index: 3000;
        animation: toastPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        backdrop-filter: blur(32px);
        -webkit-backdrop-filter: blur(32px);
    }

    .toast-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--color-success);
        color: var(--color-bg-primary);
        font-size: 2rem;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--color-success) 40%, transparent);
    }

    .toast-text {
        max-width: 400px;
        text-align: center;
        letter-spacing: -0.01em;
    }

    @keyframes toastPop {
        from {
            transform: translate(-50%, -40%) scale(0.85);
            opacity: 0;
        }
        to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
    }
</style>
