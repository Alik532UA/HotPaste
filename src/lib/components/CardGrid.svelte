<script lang="ts">
  import { getState, moveCard } from "../stores/appState.svelte";
  import SnippetCard from "./SnippetCard.svelte";
  import { draggable, dropzone } from "../utils/dnd";

  const appState = getState();

  function handleDrop(fromIndex: number, toIndex: number) {
    moveCard(fromIndex, toIndex);
  }
</script>

{#if appState.filteredCards.length > 0}
  <div class="card-grid" style="--scale: {appState.scale}" data-testid="card-grid">
    {#each appState.filteredCards as card, index (card.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="card-wrapper"
        use:draggable={index}
        use:dropzone={{ index, onDrop: handleDrop }}
        data-testid="card-wrapper"
        data-index={index}
      >
        <SnippetCard {card} />
      </div>
    {/each}
  </div>
{:else if appState.isConnected}
  <div class="empty-tab" data-testid="empty-tab">
    {#if appState.searchQuery}
      <div class="empty-tab-icon" data-testid="empty-tab-icon">🔍</div>
      <p class="empty-tab-text" data-testid="empty-tab-text">Нічого не знайдено</p>
      <p class="empty-tab-hint" data-testid="empty-tab-hint">Спробуйте змінити запит: "{appState.searchQuery}"</p>
    {:else}
      <div class="empty-tab-icon" data-testid="empty-tab-icon">📂</div>
      <p class="empty-tab-text" data-testid="empty-tab-text">Ця вкладка порожня</p>
      <p class="empty-tab-hint" data-testid="empty-tab-hint">Додайте .txt або .md файли в цю папку</p>
    {/if}
  </div>
{/if}

<style>
  .card-grid {
    columns: 300px; /* Base column width, will be scaled by zoom */
    column-gap: var(--space-3);
    padding: var(--space-4);
    max-width: 100%; /* Allow grid to grow with scale */
    margin: 0 auto;
    zoom: var(--scale, 1); /* Smooth scaling for Chromium browsers */
    transform-origin: top center;
    transition: zoom 0.1s ease-out;
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
