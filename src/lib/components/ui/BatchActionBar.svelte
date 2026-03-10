<script lang="ts">
  import { Trash2, MoveRight, X, CheckSquare } from "lucide-svelte";
  import { getState, deleteSelectedCards, moveSelectedCardsToTab, clearSelection } from "../../stores/appState.svelte";
  import { t } from "../../i18n";
  import { fly } from "svelte/transition";

  const appState = getState();
  const selectedCount = $derived(appState.selectedCardIds.size);
  const isSelectionMode = $derived(appState.isSelectionMode);
  
  let showMoveMenu = $state(false);

  function handleMove(tabPath: string) {
    moveSelectedCardsToTab(tabPath);
    showMoveMenu = false;
  }
</script>

{#if isSelectionMode || selectedCount > 0}
  <div class="batch-action-bar" transition:fly={{ y: 100, duration: 300 }} data-testid="batch-action-bar">
    <div class="selection-info" data-testid="batch-selection-info">
      <div class="icon-wrapper text-cyan">
        <CheckSquare size={18} />
      </div>
      <span class="count">{selectedCount} {t.common.selected || 'вибрано'}</span>
    </div>

    <div class="actions" data-testid="batch-actions">
      <div class="move-wrapper" data-testid="batch-move-wrapper">
        <button 
          class="action-btn move" 
          onclick={() => showMoveMenu = !showMoveMenu}
          disabled={selectedCount === 0}
          data-testid="btn-batch-move"
        >
          <MoveRight size={18} />
          <span>{t.common.move || 'Перемістити'}</span>
        </button>

        {#if showMoveMenu && selectedCount > 0}
          <div class="move-menu" data-testid="batch-move-menu">
            {#each appState.tabs as tab}
              {#if tab.path !== appState.activeTab?.path}
                <button 
                  class="menu-item" 
                  onclick={() => handleMove(tab.path)}
                  data-testid={`batch-move-item-${tab.path}`}
                  data-tab-path={tab.path}
                >
                  {tab.name}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <button 
        class="action-btn delete" 
        onclick={deleteSelectedCards}
        disabled={selectedCount === 0}
        data-testid="btn-batch-delete"
      >
        <Trash2 size={18} />
        <span>{t.common.delete}</span>
      </button>

      <div class="divider"></div>

      <button 
        class="action-btn clear" 
        onclick={clearSelection} 
        title={t.common.cancel}
        data-testid="btn-batch-clear"
      >
        <X size={18} />
      </button>
    </div>
  </div>
{/if}

<style>
  .batch-action-bar {
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-accent-cyan);
    border-radius: 20px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 5%, transparent) inset;
    z-index: 1000;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-right: 20px;
    border-right: 1px solid var(--color-border);
  }

  .text-cyan {
    color: var(--color-accent-cyan);
  }

  .count {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: var(--color-surface-1);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    transform: translateY(-2px);
  }

  .action-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .action-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .action-btn.delete:hover:not(:disabled) {
    color: white;
    background: var(--color-danger);
    border-color: var(--color-danger);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-danger) 40%, transparent);
  }

  .action-btn.move:hover:not(:disabled) {
    color: var(--color-bg-primary);
    background: var(--color-accent-cyan);
    border-color: var(--color-accent-cyan);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-cyan) 40%, transparent);
  }

  .action-btn.clear {
    padding: 10px;
    color: var(--color-text-muted);
  }

  .action-btn.clear:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-3);
  }

  .divider {
    width: 1px;
    height: 28px;
    background: var(--color-border);
    margin: 0 4px;
  }

  .move-wrapper {
    position: relative;
  }

  .move-menu {
    position: absolute;
    bottom: calc(100% + 16px);
    left: 0;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 8px;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: var(--shadow-lg);
    animation: menuAppear 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes menuAppear {
    from { opacity: 0; transform: translateY(10px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .menu-item {
    text-align: left;
    padding: 10px 14px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .menu-item:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    transform: translateX(4px);
  }
</style>
