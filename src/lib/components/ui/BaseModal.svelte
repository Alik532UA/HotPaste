<script lang="ts">
  import { X } from "lucide-svelte";
  import type { Snippet } from "svelte";
  import { focusTrap } from "../../utils/focusTrap";

  interface Props {
    title?: string;
    isOpen: boolean;
    onClose: () => void;
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
    maxWidth?: string;
    zIndex?: number;
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
    zIndex = 2000,
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
    style="z-index: {zIndex}"
    data-testid="modal-overlay"
  >
    <div 
      class="modal-content" 
      style="max-width: {maxWidth}"
      onclick={(e) => e.stopPropagation()} 
      use:focusTrap
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabindex="-1"
      data-testid={testId}
    >
      <header class="modal-header">
        <div class="header-title-area">
          {#if header}
            {@render header()}
          {:else if title}
            <h2 id="modal-title" class="default-title">{title}</h2>
          {/if}
        </div>
        <button class="close-btn" onclick={onClose} aria-label="Close" data-testid={`btn-modal-close-${testId}`}>
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
    background: color-mix(in srgb, var(--color-bg-primary) 70%, transparent);
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
    box-shadow: var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 5%, transparent) inset;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .modal-header {
    padding: 24px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-1);
    flex-shrink: 0;
  }

  .header-title-area {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
  }

  .default-title {
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }

  .close-btn {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 6px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
    transform: rotate(90deg) scale(1.1);
  }

  .modal-body {
    padding: 28px;
    display: flex;
    flex-direction: column;
    max-height: 75vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--color-bg-secondary);
  }

  .modal-footer {
    padding: 24px 28px;
    background: var(--color-surface-1);
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    flex-shrink: 0;
  }
</style>
