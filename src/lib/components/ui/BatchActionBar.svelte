<script lang="ts">
  import { Trash2, MoveRight, X, CheckSquare } from "lucide-svelte";
  import { getState, deleteSelectedCards, moveSelectedCardsToTab, clearSelection } from "../../stores/appState.svelte";
  import { t } from "../../i18n";
  import { fly } from "svelte/transition";

  const appState = getState();
  const selectedCount = $derived(appState.selectedCardIds.size);
  
  let showMoveMenu = $state(false);

  function handleMove(tabPath: string) {
    moveSelectedCardsToTab(tabPath);
    showMoveMenu = false;
  }
</script>

{#if selectedCount > 0}
  <div class="batch-action-bar" transition:fly={{ y: 100, duration: 300 }}>
    <div class="selection-info">
      <div class="icon-wrapper text-cyan">
        <CheckSquare size={18} />
      </div>
      <span class="count">{selectedCount} {t.common.selected || 'вибрано'}</span>
    </div>

    <div class="actions">
      <div class="move-wrapper">
        <button class="action-btn move" onclick={() => showMoveMenu = !showMoveMenu}>
          <MoveRight size={18} />
          <span>{t.common.move || 'Перемістити'}</span>
        </button>

        {#if showMoveMenu}
          <div class="move-menu">
            {#each appState.tabs as tab}
              {#if tab.path !== appState.activeTab?.path}
                <button class="menu-item" onclick={() => handleMove(tab.path)}>
                  {tab.name}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      <button class="action-btn delete" onclick={deleteSelectedCards}>
        <Trash2 size={18} />
        <span>{t.common.delete}</span>
      </button>

      <div class="divider"></div>

      <button class="action-btn clear" onclick={clearSelection} title={t.common.cancel}>
        <X size={18} />
      </button>
    </div>
  </div>
{/if}

<style>
  .batch-action-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-surface-1);
    border: 1px solid var(--color-accent-cyan);
    border-radius: 16px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    backdrop-filter: blur(20px);
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-right: 16px;
    border-right: 1px solid var(--color-border);
  }

  .text-cyan {
    color: var(--color-accent-cyan);
  }

  .count {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--color-text-primary);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .action-btn.delete:hover {
    color: #ff4b4b;
    background: rgba(255, 75, 75, 0.1);
    border-color: rgba(255, 75, 75, 0.2);
  }

  .action-btn.move:hover {
    color: var(--color-accent-cyan);
    background: rgba(0, 210, 255, 0.1);
    border-color: rgba(0, 210, 255, 0.2);
  }

  .divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 4px;
  }

  .move-wrapper {
    position: relative;
  }

  .move-menu {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 0;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 6px;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .menu-item {
    text-align: left;
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .menu-item:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }
</style>
