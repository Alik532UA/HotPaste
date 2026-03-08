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
        gap: 12px;
        padding: 24px 48px;
        border-radius: 20px;
        background: rgba(18, 18, 28, 0.9);
        border: 1px solid var(--color-accent-green);
        color: var(--color-accent-green);
        font-family: var(--font-family);
        font-size: 1.1rem;
        font-weight: 600;
        box-shadow:
            0 24px 64px rgba(0, 0, 0, 0.5),
            0 0 40px rgba(0, 255, 136, 0.15);
        z-index: 1000;
        animation: toastPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
    }

    .toast-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(0, 255, 136, 0.1);
        font-size: 1.8rem;
        border: 1px solid rgba(0, 255, 136, 0.2);
    }

    .toast-text {
        max-width: 400px;
        text-align: center;
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
