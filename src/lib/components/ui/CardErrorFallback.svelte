<script lang="ts">
  import { AlertTriangle, RefreshCw } from "lucide-svelte";
  import type { Card } from "../../types";
  import { t } from "../../i18n";

  interface Props {
    card: Card;
    error: any;
    reset: () => void;
  }

  let { card, error, reset }: Props = $props();
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
    <button class="reset-btn" onclick={reset}>
      <RefreshCw size={14} />
      {t.common?.retry || "Retry"}
    </button>
  </div>
</div>

<style>
  .card-error-fallback {
    background: rgba(255, 75, 75, 0.05);
    border: 1px solid rgba(255, 75, 75, 0.3);
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
    color: #ff4b4b;
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
    background: rgba(0, 0, 0, 0.2);
    padding: 4px 8px;
    border-radius: 4px;
    color: #ff4b4b;
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
    border: 1px solid rgba(255, 75, 75, 0.3);
    color: #ff4b4b;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    background: rgba(255, 75, 75, 0.1);
    border-color: #ff4b4b;
  }
</style>
