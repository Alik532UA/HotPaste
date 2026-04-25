<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { uiState } from "../../stores/uiState.svelte";
  import { Check, X } from "lucide-svelte";
  import { t } from "../../i18n";
  import Input from "./Input.svelte";

  const prompt = $derived(uiState.activePrompt);
  let value = $state("");

  $effect(() => {
    if (prompt && !value) {
      value = prompt.placeholder || "";
    }
  });

  function handleConfirm() {
    if (prompt && value.trim()) {
      prompt.onConfirm(value.trim());
      uiState.closePrompt();
      value = ""; // Reset for next time
    }
  }

  function handleCancel() {
    uiState.closePrompt();
    value = "";
  }

  function onKeydown(e: KeyboardEvent) {
    if (!prompt) return;
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && value.trim()) {
      handleConfirm();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if prompt}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop" onmousedown={handleCancel} transition:fade={{ duration: 200 }}>
    <div 
      class="modal-content" 
      onmousedown={(e) => e.stopPropagation()} 
      transition:scale={{ duration: 300, start: 0.95, opacity: 0 }}
    >
      <div class="confirm-header">
        <h2>{prompt.title}</h2>
      </div>

      <div class="confirm-body">
        <Input
          id="prompt-input"
          bind:value
          placeholder="Введіть назву..."
          testId="prompt-input-field"
        />
      </div>

      <div class="confirm-actions">
        <button class="btn-cancel" onclick={handleCancel}>
            <X size={18} />
            {t.common.cancel}
        </button>
        <button class="btn-confirm" onclick={handleConfirm} disabled={!value.trim()}>
            <Check size={18} />
            {t.common.save}
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
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .confirm-header h2 { 
    margin: 0; 
    font-size: 1.5rem; 
    font-weight: 800; 
    color: var(--color-text-primary); 
    text-align: center; 
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
  }
  
  .btn-confirm:hover:not(:disabled) { 
    filter: brightness(1.1); 
    transform: translateY(-2px); 
  }
  
  .btn-confirm:disabled { 
    opacity: 0.5; 
    cursor: not-allowed; 
  }

  .btn-cancel {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
  }
  
  .btn-cancel:hover { 
    background: var(--color-surface-3); 
  }
</style>