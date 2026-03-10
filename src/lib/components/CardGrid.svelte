<script lang="ts">
  import { FolderOpen, Search as SearchIcon } from "lucide-svelte";
  import { getState, moveCard } from "../stores/appState.svelte";
  import SnippetCard from "./SnippetCard.svelte";
  import CardErrorFallback from "./ui/CardErrorFallback.svelte";
  import { draggable, dropzone } from "../utils/dnd";
  import { t } from "../i18n";

  const appState = getState();

  function handleDrop(fromIndex: number, toIndex: number) {
    moveCard(fromIndex, toIndex);
  }

  function handleGridKeydown(e: KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;

    const activeEl = document.activeElement as HTMLElement;
    if (!activeEl || !activeEl.classList.contains("snippet-card")) return;

    const gridElements = Array.from(document.querySelectorAll(".snippet-card.interactive")) as HTMLElement[];
    const currentIndex = gridElements.indexOf(activeEl);
    if (currentIndex === -1) return;

    e.preventDefault();

    let nextIndex = currentIndex;
    const activeRect = activeEl.getBoundingClientRect();
    const activeCenter = {
      x: activeRect.left + activeRect.width / 2,
      y: activeRect.top + activeRect.height / 2
    };

    if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = gridElements.length - 1;
    } else {
      // Spatial navigation
      let bestDist = Infinity;
      let candidateIndex = -1;

      for (let i = 0; i < gridElements.length; i++) {
        if (i === currentIndex) continue;
        const targetEl = gridElements[i];
        const targetRect = targetEl.getBoundingClientRect();
        const targetCenter = {
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2
        };

        const dx = targetCenter.x - activeCenter.x;
        const dy = targetCenter.y - activeCenter.y;

        let isCorrectDirection = false;
        if (e.key === "ArrowRight") isCorrectDirection = dx > 10 && Math.abs(dy) < targetRect.height;
        if (e.key === "ArrowLeft") isCorrectDirection = dx < -10 && Math.abs(dy) < targetRect.height;
        if (e.key === "ArrowDown") isCorrectDirection = dy > 10 && Math.abs(dx) < 50;
        if (e.key === "ArrowUp") isCorrectDirection = dy < -10 && Math.abs(dx) < 50;

        if (isCorrectDirection) {
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            candidateIndex = i;
          }
        }
      }

      if (candidateIndex !== -1) {
        nextIndex = candidateIndex;
      } else {
        // Fallback for linear navigation if spatial fails
        if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex++;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") nextIndex--;
      }
    }

    // Clamp and focus
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= gridElements.length) nextIndex = gridElements.length - 1;

    gridElements[nextIndex]?.focus();
  }
</script>

{#if appState.filteredCards.length > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="card-grid" 
    style="--scale: {appState.scale}" 
    data-testid="card-grid"
    onkeydown={handleGridKeydown}
  >
    {#each appState.filteredCards as card, index (card.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="card-wrapper"
        use:draggable={index}
        use:dropzone={{ index, onDrop: handleDrop }}
        data-testid="card-wrapper"
        data-index={index}
      >
        <svelte:boundary>
          <SnippetCard {card} />
          
          {#snippet failed(error, reset)}
            <CardErrorFallback {card} {error} {reset} />
          {/snippet}
        </svelte:boundary>
      </div>
    {/each}
  </div>
{:else if appState.isConnected}
  <div class="empty-tab" data-testid="empty-tab">
    {#if appState.searchQuery}
      <div class="empty-tab-icon" data-testid="empty-tab-icon"><SearchIcon size={48} /></div>
      <p class="empty-tab-text" data-testid="empty-tab-text">{t.common.empty}</p>
      <p class="empty-tab-hint" data-testid="empty-tab-hint">{t.common.search}: "{appState.searchQuery}"</p>
    {:else}
      <div class="empty-tab-icon" data-testid="empty-tab-icon"><FolderOpen size={48} /></div>
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
