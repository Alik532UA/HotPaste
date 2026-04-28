<script lang="ts">
  import { FolderOpen, Search as SearchIcon } from "lucide-svelte";
  import { getState, moveCard, moveCardToFolder, saveCurrentTabConfig } from "../stores/appState.svelte";
  import SnippetCard from "./SnippetCard.svelte";
  import AddSnippetCard from "./AddSnippetCard.svelte";
  import CardErrorFallback from "./ui/CardErrorFallback.svelte";
  import { uiState } from "../stores/uiState.svelte";
  import type { Card } from "../types";
  import { draggable, dropzone } from "../utils/dnd";
  import { t } from "../i18n";
  import { flip } from "svelte/animate";

  const appState = getState();

  // Group cards by subfolder for the "All" view
  let groupedCards = $derived.by(() => {
    const cards = appState.filteredCards;
    const filter = uiState.activeSubfolderFilter;

    // If a specific filter is active (not 'all'), we don't need group headers
    if (filter !== 'all') {
      return [{ name: null, cards }];
    }

    const groups: Record<string, Card[]> = {};
    const rootCards: Card[] = [];

    cards.forEach(card => {
      if (card.subfolder) {
        if (!groups[card.subfolder]) groups[card.subfolder] = [];
        groups[card.subfolder].push(card);
      } else {
        rootCards.push(card);
      }
    });

    const result: { name: string | null, cards: Card[] }[] = [];
    
    // Add root cards first if they exist
    if (rootCards.length > 0) {
      result.push({ name: 'Root', cards: rootCards });
    }

    // Add subfolder groups sorted by name
    Object.keys(groups).sort().forEach(folder => {
      result.push({ name: folder, cards: groups[folder] });
    });

    return result;
  });

  /** Get global index of a card in the full tab list */
  function getGlobalIndex(card: Card): number {
    return appState.activeCards.findIndex(c => c.id === card.id);
  }

  function handleMove(fromCard: Card, toCard: Card) {
    if (!fromCard || !toCard || fromCard.id === toCard.id) return;
    
    const fromIdx = getGlobalIndex(fromCard);
    const toIdx = getGlobalIndex(toCard);
    
    if (fromIdx !== -1 && toIdx !== -1) {
        moveCard(fromIdx, toIdx);
    }
  }

  function handleDrop(fromData: any, target: Card | string) {
    // Check if it's a card fromData
    if (typeof fromData === 'object' && fromData.id) {
        if (typeof target === 'string') {
            // Dropped on a folder header
            const folderName = target === 'Root' ? null : target;
            logService.info('dnd', `Moving card ${fromData.name} to folder: ${folderName || 'root'}`);
            moveCardToFolder(fromData, folderName);
        } else {
            // Dropped on another card (already moved by handleMove)
            saveCurrentTabConfig();
        }
    }
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
    {#each groupedCards as group}
      {#if group.name && groupedCards.length > 1}
        <div 
            class="folder-header"
            use:dropzone={{ type: 'card', data: group.name, onDrop: handleDrop }}
        >
          <FolderOpen size={16} />
          <span>{group.name}</span>
          <div class="header-line"></div>
        </div>
      {/if}

      {#each group.cards as card (card.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="card-wrapper"
          use:draggable={{ data: card, type: 'card', handle: '.drag-handle' }}
          use:dropzone={{ data: card, type: 'card', onMove: handleMove, onDrop: handleDrop }}
          animate:flip={{ duration: 300 }}
          data-testid="card-wrapper"
        >
          <svelte:boundary>
            <SnippetCard {card} />
            
            {#snippet failed(error, reset)}
              <CardErrorFallback {card} {error} {reset} />
            {/snippet}
          </svelte:boundary>
        </div>
      {/each}

      <!-- Add button at the end of each folder group -->
      {#if !appState.searchQuery}
        <div class="card-wrapper">
          <AddSnippetCard subfolder={group.name} />
        </div>
      {/if}
    {/each}
  </div>
{:else if appState.isConnected}
  <div class="empty-tab" data-testid="empty-tab">
    {#if appState.searchQuery}
      <div class="empty-tab-icon" data-testid="empty-tab-icon"><SearchIcon size={48} /></div>
      <p class="empty-tab-text" data-testid="empty-tab-text">{t.common.empty}</p>
      <p class="empty-tab-hint" data-testid="empty-tab-hint">{t.common.search}: "{appState.searchQuery}"</p>
    {:else}
      <div class="empty-add-container">
        <AddSnippetCard subfolder={null} />
        <p class="empty-tab-hint">{t.tabs.emptyHint}</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .empty-add-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    max-width: 300px;
  }
  
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(300px * var(--scale, 1)), 1fr));
    gap: var(--space-3);
    padding: var(--space-4);
    max-width: 100%;
    margin: 0 auto;
    transition: all 0.1s ease-out;
  }

  .folder-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) 0 var(--space-2) 0;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    user-select: none;
    opacity: 0.8;
    margin-top: var(--space-4);
  }

  .folder-header:first-child {
    margin-top: 0;
    padding-top: 0;
  }

  .header-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, var(--color-border), transparent);
    margin-left: var(--space-2);
  }

  .card-wrapper {
    height: fit-content;
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
