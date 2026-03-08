<script lang="ts">
  import { X } from "lucide-svelte";
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    isOpen: boolean;
    onClose: () => void;
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
    maxWidth?: string;
    testId?: string;
  }

  let { 
    title, 
    isOpen, 
    onClose, 
    header, 
    children, 
    footer, 
    maxWidth = "480px",
    testId = "base-modal"
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isOpen) {
      onClose();
    }
  }

  function handleOverlayClick() {
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div 
    class="modal-overlay" 
    onclick={handleOverlayClick}
    data-testid="modal-overlay"
  >
    <div 
      class="modal-content" 
      style="max-width: {maxWidth}"
      onclick={(e) => e.stopPropagation()} 
      data-testid={testId}
    >
      <header class="modal-header">
        <div class="header-title-area">
          {#if header}
            {@render header()}
          {:else if title}
            <h2 class="default-title">{title}</h2>
          {/if}
        </div>
        <button class="close-btn" onclick={onClose} aria-label="Close" data-testid="btn-modal-close">
          <X size={20} />
        </button>
      </header>

      <div class="modal-body" data-testid="modal-body">
        {@render children()}
      </div>

      {#if footer}
        <footer class="modal-footer" data-testid="modal-footer">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    width: 100%;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .modal-header {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .header-title-area {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .default-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text-primary);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.2s;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    max-height: 70vh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .modal-footer {
    padding: 20px 24px;
    background: var(--color-surface-1);
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
  }
</style>
