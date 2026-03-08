<script lang="ts">
  import { getState, moveCard } from "../stores/appState.svelte";
  import SnippetCard from "./SnippetCard.svelte";
  import { draggable, dropzone } from "../utils/dnd";
  import { t } from "../i18n";

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
      <p class="empty-tab-text" data-testid="empty-tab-text">{t.common.empty}</p>
      <p class="empty-tab-hint" data-testid="empty-tab-hint">{t.common.search}: "{appState.searchQuery}"</p>
    {:else}
      <div class="empty-tab-icon" data-testid="empty-tab-icon">📂</div>
      <p class="empty-tab-text" data-testid="empty-tab-text">{t.tabs.empty}</p>
      <p class="empty-tab-hint" data-testid="empty-tab-hint">{t.tabs.emptyHint}</p>
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
    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
  }

  /* Empty state for tabs */
  .empty-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    gap: var(--space-3);
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .empty-tab-icon {
    font-size: 3rem;
    opacity: 0.3;
    margin-bottom: var(--space-2);
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
