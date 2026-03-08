<script lang="ts">
  import { getState } from '../stores/appState.svelte';
  import SnippetCard from './SnippetCard.svelte';

  const state = getState();
</script>

{#if state.activeCards.length > 0}
  <div class="card-grid" style="--scale: {state.scale}">
    {#each state.activeCards as card (card.filePath)}
      <SnippetCard {card} />
    {/each}
  </div>
{:else if state.isConnected}
  <div class="empty-tab">
    <div class="empty-tab-icon">📂</div>
    <p class="empty-tab-text">Ця вкладка порожня</p>
    <p class="empty-tab-hint">Додайте .txt або .md файли в цю папку</p>
  </div>
{/if}

<style>
  .card-grid {
    columns: calc(280px * var(--scale, 1));
    column-gap: var(--space-3);
    padding: var(--space-4);
    max-width: 1800px;
    margin: 0 auto;
  }

  .empty-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    gap: var(--space-2);
  }

  .empty-tab-icon {
    font-size: 3rem;
    opacity: 0.4;
  }

  .empty-tab-text {
    color: var(--color-text-muted);
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0;
  }

  .empty-tab-hint {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    opacity: 0.6;
    margin: 0;
  }
</style>
