<script lang="ts">
  import { AlertOctagon, RefreshCcw } from "lucide-svelte";
  import { t } from "../../i18n";

  interface Props {
    error: any;
    reset: () => void;
  }

  let { error, reset }: Props = $props();
</script>

<div class="global-error-container">
  <div class="error-card">
    <div class="icon-wrapper">
      <AlertOctagon size={48} strokeWidth={1.5} />
    </div>
    
    <h1>{t.errors?.rendering || "Критична помилка додатку"}</h1>
    <p class="description">
      Виникла непередбачувана помилка під час роботи інтерфейсу.
    </p>
    
    {#if error?.message}
      <div class="error-details">
        <code>{error.message}</code>
      </div>
    {/if}

    <button class="reset-btn" onclick={reset}>
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
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .icon-wrapper {
    color: #ff4b4b;
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
    background: rgba(255, 75, 75, 0.05);
    border: 1px solid rgba(255, 75, 75, 0.2);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 32px;
    text-align: left;
    overflow-x: auto;
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: #ff4b4b;
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
    box-shadow: 0 8px 24px rgba(123, 97, 255, 0.4);
  }

  .reset-btn:active {
    transform: translateY(0);
  }
</style>
