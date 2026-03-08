<script lang="ts">
  import {
    getState,
    closeContextMenu,
    copyCard,
    duplicateCard,
    deleteCard,
    moveCardToTab,
  } from "../stores/appState.svelte";
  import * as icons from "lucide-svelte";
  import { onMount } from "svelte";

  const appState = getState();
  const contextMenu = $derived(appState.activeContextMenu);

  let menuElement = $state<HTMLElement | null>(null);

  // Close on click outside
  function handleOutsideClick(e: MouseEvent) {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      closeContextMenu();
    }
  }

  // Adjust menu position if it goes off screen
  let position = $derived.by(() => {
    if (!contextMenu) return { x: 0, y: 0 };
    
    let x = contextMenu.x;
    let y = contextMenu.y;
    
    // Crude screen edge detection (can be improved with actual menu dimensions)
    if (x > window.innerWidth - 180) x -= 180;
    if (y > window.innerHeight - 300) y -= 280;
    
    return { x, y };
  });

  onMount(() => {
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  });

  function handleAction(action: () => void) {
    action();
    closeContextMenu();
  }

  function handleMove(tabPath: string) {
    if (contextMenu) {
      moveCardToTab(contextMenu.card, tabPath);
    }
    closeContextMenu();
  }
</script>

{#if contextMenu}
  <div
    class="context-menu"
    bind:this={menuElement}
    style="left: {position.x}px; top: {position.y}px;"
    oncontextmenu={(e) => e.preventDefault()}
  >
    <div class="menu-header">
      <span class="card-name">{contextMenu.card.name}</span>
    </div>

    <button class="menu-item" onclick={() => handleAction(() => copyCard(contextMenu.card))}>
      <icons.Copy size={14} />
      <span>Копіювати текст</span>
      <span class="shortcut">{contextMenu.card.hotkey?.toUpperCase() || ""}</span>
    </button>

    <div class="divider"></div>

    <button class="menu-item" onclick={() => handleAction(() => duplicateCard(contextMenu.card))}>
      <icons.CopyPlus size={14} />
      <span>Дублювати</span>
    </button>

    <div class="menu-item move-item">
      <icons.ExternalLink size={14} />
      <span>Перемістити</span>
      <icons.ChevronRight size={14} class="arrow" />
      
      <!-- Submenu for tabs -->
      <div class="submenu">
        {#each appState.tabs as tab}
          {#if tab.path !== contextMenu.card.filePath.split('/').slice(0, -1).join('/') && !(tab.path === '__root__' && contextMenu.card.filePath.startsWith('__root__/'))}
            <button class="menu-item" onclick={() => handleMove(tab.path)}>
              <span>{tab.icon || "📂"} {tab.name}</span>
            </button>
          {/if}
        {/each}
        {#if appState.tabs.length <= 1}
            <div class="menu-item disabled">Немає інших вкладок</div>
        {/if}
      </div>
    </div>

    <div class="divider"></div>

    <button class="menu-item danger" onclick={() => handleAction(() => deleteCard(contextMenu.card))}>
      <icons.Trash2 size={14} />
      <span>Видалити</span>
    </button>
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    width: 200px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    padding: 6px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    animation: menuAppear 0.15s ease-out;
  }

  @keyframes menuAppear {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .menu-header {
    padding: 8px 10px;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--color-surface-2);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.1s ease;
    position: relative;
    text-align: left;
  }

  .menu-item:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .menu-item.danger {
    color: #ff5555;
  }

  .menu-item.danger:hover {
    background: rgba(255, 85, 85, 0.1);
  }

  .menu-item.disabled {
    opacity: 0.5;
    cursor: default;
  }

  .shortcut {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    opacity: 0.5;
  }

  .divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }

  .arrow {
    margin-left: auto;
    opacity: 0.5;
  }

  /* Submenu logic */
  .move-item:hover .submenu {
    display: block;
  }

  .submenu {
    display: none;
    position: absolute;
    left: 100%;
    top: -6px;
    width: 180px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }
</style>
