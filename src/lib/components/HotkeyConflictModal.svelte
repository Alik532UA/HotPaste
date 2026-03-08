<script lang="ts">
  import { getState, resolveHotkeyConflict, closeHotkeyConflict } from "../stores/appState.svelte";
  import { X, AlertTriangle } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { t } from "../i18n";

  const appState = getState();
  const conflict = $derived(appState.activeHotkeyConflict);
  
  // Safe derived array to prevent null access errors in {#each}
  const conflictCards = $derived(conflict?.cards ?? []);

  function handleSelect(card: any) {
    resolveHotkeyConflict(card);
  }

  function handleClose() {
    closeHotkeyConflict();
  }
</script>

{#if conflict}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onmousedown={handleClose} transition:fade={{ duration: 200 }}>
    <div 
        class="modal-content" 
        onmousedown={(e) => e.stopPropagation()} 
        transition:scale={{ duration: 300, start: 0.95 }}
    >
      <div class="modal-header">
        <div class="header-title">
          <AlertTriangle color="#ff9f0a" size={20} />
          <h2>{t.modals.conflictTitle} {appState.getHotkeyLabel(conflict.code)}</h2>
        </div>
        <button class="btn-close" onclick={handleClose} aria-label={t.common.cancel}>
          <X size={20} />
        </button>
      </div>

      <div class="modal-body">
        <p class="description">
          {t.modals.conflictDesc}
        </p>

        <div class="conflict-list">
          {#each conflictCards as card}
            <button class="conflict-item" onclick={() => handleSelect(card)}>
              <div class="card-info">
                <span class="card-name">{card.name}</span>
                <span class="card-path">{card.fileName}</span>
              </div>
              <div class="action-hint">{t.common.default}</div>
            </button>
          {/each}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={handleClose}>{t.common.cancel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    width: 100%;
    max-width: 450px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    transition: all 0.2s;
  }

  .btn-close:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: 24px;
  }

  .description {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .conflict-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .conflict-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    width: 100%;
  }

  .conflict-item:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-violet);
    transform: translateY(-2px);
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .card-path {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .action-hint {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-accent-violet);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .conflict-item:hover .action-hint {
    opacity: 1;
  }

  .modal-footer {
    padding: 16px 24px;
    background: var(--color-bg-primary);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
  }

  .btn-secondary {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--color-surface-2);
  }
</style>
