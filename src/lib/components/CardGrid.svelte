<script lang="ts">
  import { getState, moveCard } from "../stores/appState.svelte";
  import SnippetCard from "./SnippetCard.svelte";
  import { draggable, dropzone } from "../utils/dnd";

  const appState = getState();

  function handleDrop(fromIndex: number, toIndex: number) {
    moveCard(fromIndex, toIndex);
  }
</script>

{#if appState.activeCards.length > 0}
  <div class="card-grid" style="--scale: {appState.scale}">
    {#each appState.activeCards as card, index (card.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="card-wrapper"
        use:draggable={index}
        use:dropzone={{ index, onDrop: handleDrop }}
      >
        <SnippetCard {card} />
      </div>
    {/each}
  </div>
{:else if appState.isConnected}
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

  .card-wrapper {
    break-inside: avoid;
    margin-bottom: var(--space-3);
    border-radius: var(--radius-md);
    transition:
      transform 0.2s,
      opacity 0.2s;
    user-select: none; /* Prevent text selection to allow drag and drop */
    -webkit-user-select: none;
    cursor: grab;
  }

  .card-wrapper:active {
    cursor: grabbing;
  }

  :global(.card-wrapper.dragging) {
    opacity: 0.5;
    transform: scale(0.95);
  }

  :global(.card-wrapper.drag-over) {
    outline: 2px dashed var(--color-accent-blue);
    outline-offset: 4px;
    transform: translateY(4px);
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
