<script lang="ts">
  import { AlertOctagon, RefreshCcw } from "lucide-svelte";
  import { t } from "../../i18n";

  interface Props {
    error: any;
    reset: () => void;
  }

  let { error, reset }: Props = $props();
</script>

<div class="global-error-container" data-testid="global-error-fallback">
  <div class="error-card" data-testid="global-error-card">
    <div class="icon-wrapper">
      <AlertOctagon size={48} strokeWidth={1.5} />
    </div>
    
    <h1 data-testid="global-error-title">{t.errors?.rendering || "Критична помилка додатку"}</h1>
    <p class="description" data-testid="global-error-desc">
      Виникла непередбачувана помилка під час роботи інтерфейсу.
    </p>
    
    {#if error?.message}
      <div class="error-details" data-testid="global-error-details">
        <code>{error.message}</code>
      </div>
    {/if}

    <button class="reset-btn" onclick={reset} data-testid="btn-global-error-retry">
      <RefreshCcw size={18} />
      <span>{t.common?.retry || "Спробувати знову"}</span>
    </button>
  </div>
</div>

<style>
  .global-error-container {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary);
    padding: 24px;
    z-index: 9999;
  }

  .error-card {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 24px;
    padding: 48px;
    max-width: 500px;
    width: 100%;
    text-align: center;
    box-shadow: var(--shadow-lg);
  }

  .icon-wrapper {
    color: var(--color-danger);
    margin-bottom: 24px;
    display: flex;
    justify-content: center;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 12px;
    color: var(--color-text-primary);
  }

  .description {
    color: var(--color-text-secondary);
    font-size: 0.95rem;
    margin-bottom: 24px;
    line-height: 1.6;
  }

  .error-details {
    background: color-mix(in srgb, var(--color-danger) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 32px;
    text-align: left;
    overflow-x: auto;
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--color-danger);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px;
    background: var(--color-accent-violet);
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--color-accent-violet) 40%, transparent);
  }

  .reset-btn:active {
    transform: translateY(0);
  }
</style>
