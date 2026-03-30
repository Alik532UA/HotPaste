<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { uiState } from "../../stores/uiState.svelte";
  import { Check, X, MousePointer2, Keyboard } from "lucide-svelte";
  import { t } from "../../i18n";
  import IconRenderer from "./IconRenderer.svelte";

  const confirmation = $derived(uiState.activeActionConfirmation);

  function handleConfirm() {
    confirmation?.onConfirm();
    uiState.closeActionConfirmation();
  }

  function handleCancel() {
    uiState.closeActionConfirmation();
  }

  // Listen for the hotkey to decrement the counter
  function onKeydown(e: KeyboardEvent) {
    if (!confirmation) return;
    
    // If Escape is pressed, cancel
    if (e.key === "Escape") {
      handleCancel();
      return;
    }

    // If the same key is pressed, decrement remaining
    if (e.code === confirmation.key || (confirmation.card && e.code === confirmation.card.hotkey)) {
      e.preventDefault();
      uiState.confirmActionStep();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if confirmation}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onmousedown={handleCancel} transition:fade={{ duration: 200 }}>
    <div 
      class="modal-content" 
      onmousedown={(e) => e.stopPropagation()} 
      transition:scale={{ duration: 300, start: 0.95 }}
    >
      <div class="confirm-header">
        <div class="icon-pulse">
            {#if confirmation.card}
                <IconRenderer icon={confirmation.card.icon} size={48} />
            {:else if confirmation.assignment}
                <IconRenderer icon={confirmation.assignment.icon} size={48} />
            {/if}
        </div>
        <h2>Підтвердження дії</h2>
        <p class="target-name">
            {confirmation.card?.name || confirmation.assignment?.name || "Дія"}
        </p>
      </div>

      <div class="confirm-body">
        <div class="counter-display">
            <span class="remaining">{confirmation.remaining}</span>
            <span class="label">натискань залишилось</span>
        </div>
        
        <div class="instruction">
            <Keyboard size={16} />
            <span>Натисніть повторно клавішу <strong>{confirmation.key || confirmation.card?.hotkey || '?'}</strong></span>
        </div>
      </div>

      <div class="confirm-actions">
        <button class="btn-cancel" onclick={handleCancel}>
            <X size={18} />
            {t.common.cancel}
        </button>
        <button class="btn-confirm" onclick={handleConfirm}>
            <Check size={18} />
            Підтвердити зараз
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-bg-primary) 80%, transparent);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5000;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 28px;
    width: 100%;
    max-width: 400px;
    padding: 32px;
    box-shadow: var(--shadow-2xl);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .confirm-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .icon-pulse {
    width: 80px;
    height: 80px;
    background: var(--color-surface-2);
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
    border: 1px solid var(--color-border);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-cyan) 40%, transparent); }
    70% { box-shadow: 0 0 0 20px color-mix(in srgb, var(--color-accent-cyan) 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-cyan) 0%, transparent); }
  }

  h2 { margin: 0; font-size: 1.5rem; font-weight: 800; color: var(--color-text-primary); }
  .target-name { font-size: 1rem; color: var(--color-accent-cyan); font-weight: 600; margin: 0; }

  .counter-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--color-surface-1);
    border-radius: 20px;
    padding: 20px;
    border: 1px solid var(--color-border);
  }

  .remaining {
    font-size: 4rem;
    font-weight: 900;
    line-height: 1;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
  }

  .label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
    font-weight: 700;
    margin-top: 4px;
  }

  .instruction {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 16px;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .confirm-actions {
    display: flex;
    gap: 12px;
  }

  .btn-confirm, .btn-cancel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    border-radius: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-confirm {
    background: var(--color-accent-cyan);
    color: black;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
  }
  .btn-confirm:hover { transform: translateY(-2px); filter: brightness(1.1); }

  .btn-cancel {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
  }
  .btn-cancel:hover { background: var(--color-surface-3); }
</style>