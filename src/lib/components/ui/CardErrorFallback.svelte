<script lang="ts">
  import { AlertTriangle, RefreshCw } from "lucide-svelte";
  import type { Card } from "../../types";
  import { t } from "../../i18n";
  import { logService } from "../../services/logService.svelte";

  interface Props {
    card: Card;
    error: any;
    reset: () => void;
  }

  let { card, error, reset }: Props = $props();

  $effect(() => {
    logService.log("error", `Rendering error in card: ${card.name}`, error);
  });
</script>

<div class="card-error-fallback" data-testid="card-error-fallback">
  <div class="error-header">
    <AlertTriangle size={16} class="error-icon" />
    <span class="error-title">{card.name || "Error"}</span>
  </div>
  
  <div class="error-body">
    <p class="error-msg">{t.errors?.rendering || "Rendering error"}</p>
    {#if error?.message}
      <code class="error-details">{error.message}</code>
    {/if}
  </div>

  <div class="error-footer">
    <button class="reset-btn" onclick={reset} data-testid="btn-card-error-retry">
      <RefreshCw size={14} />
      {t.common?.retry || "Retry"}
    </button>
  </div>
</div>

<style>
  .card-error-fallback {
    background: color-mix(in srgb, var(--color-danger) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 120px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-danger);
  }

  .error-title {
    font-size: 0.85rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .error-msg {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .error-details {
    font-size: 0.65rem;
    font-family: var(--font-mono);
    background: var(--color-bg-secondary);
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--color-danger);
    word-break: break-all;
    max-height: 60px;
    overflow-y: auto;
  }

  .error-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    color: var(--color-danger);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border-color: var(--color-danger);
  }
</style>
