<script lang="ts">
  import {
    getState,
    closeContextMenu,
    copyCard,
    duplicateCard,
    deleteCard,
    moveCardToTab,
    openSettings,
    openTabSettings,
    deleteTab,
    duplicateTab,
    startEditingCard,
    moveCardRelative,
  } from "../stores/appState.svelte";
  import * as icons from "lucide-svelte";
  import { onMount } from "svelte";
  import type { Card, Tab } from "../types";
  import { t } from "../i18n";

  const appState = getState();
  const contextMenu = $derived(appState.activeContextMenu);
  
  // Type guards
  const isCard = $derived(contextMenu && "filePath" in (contextMenu.card as any));
  const isTab = $derived(contextMenu && "path" in (contextMenu.card as any));
  
  // Casting for convenience
  const card = $derived(isCard ? (contextMenu?.card as unknown as Card) : null);
  const tab = $derived(isTab ? (contextMenu?.card as unknown as Tab) : null);

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
    
    // Crude screen edge detection
    if (x > window.innerWidth - 220) x -= 200;
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
    if (card) {
      moveCardToTab(card, tabPath);
    }
    closeContextMenu();
  }
</script>

{#if contextMenu}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="context-menu"
    bind:this={menuElement}
    style="left: {position.x}px; top: {position.y}px;"
    oncontextmenu={(e) => e.preventDefault()}
    role="menu"
    tabindex="-1"
    data-testid="context-menu"
  >
    <div class="menu-header">
      <span class="card-name" data-testid="menu-title">{isCard ? card?.name : tab?.name}</span>
    </div>

    {#if isCard && card}
      <!-- Card Menu Items -->
      <button class="menu-item" onclick={() => handleAction(() => copyCard(card))} role="menuitem" data-testid="menu-item-copy">
        <icons.Copy size={14} />
        <span>{t.menu.copyText}</span>
        <span class="shortcut" data-testid="menu-item-shortcut">{appState.getHotkeyLabel(card.hotkey)}</span>
      </button>

      <button class="menu-item" onclick={() => handleAction(() => startEditingCard(card))} role="menuitem" data-testid="menu-item-edit">
        <icons.Edit3 size={14} />
        <span>{t.menu.edit}</span>
      </button>

      <button class="menu-item" onclick={() => handleAction(() => openSettings(card))} role="menuitem" data-testid="menu-item-settings">
        <icons.Settings size={14} />
        <span>{t.menu.settings}</span>
      </button>

      <div class="divider" role="separator"></div>

      <button class="menu-item" onclick={() => handleAction(() => duplicateCard(card))} role="menuitem" data-testid="menu-item-duplicate">
        <icons.CopyPlus size={14} />
        <span>{t.menu.duplicate}</span>
      </button>

      <div class="menu-item move-item" role="menuitem" aria-haspopup="true" data-testid="menu-item-move">
        <icons.ExternalLink size={14} />
        <span>{t.menu.move}</span>
        <icons.ChevronRight size={14} class="arrow-icon" />
        
        <div class="submenu" role="menu" data-testid="submenu-move">
          {#each appState.tabs as t_item}
            {#if t_item.path !== card.filePath.split('/').slice(0, -1).join('/') && !(t_item.path === '__root__' && card.filePath.startsWith('__root__/'))}
              <button class="menu-item" onclick={() => handleMove(t_item.path)} role="menuitem" data-testid="submenu-item-move-to" data-tab-path={t_item.path}>
                <span>{t_item.icon || "📂"} {t_item.name}</span>
              </button>
            {/if}
          {/each}
          {#if appState.tabs.length <= 1}
              <div class="menu-item disabled" role="menuitem" aria-disabled="true">{t.menu.moveTarget}</div>
          {/if}
        </div>
      </div>

      <!-- Nudge / Move around -->
      <div class="menu-item move-item" role="menuitem" aria-haspopup="true" data-testid="menu-item-nudge">
        <icons.Move size={14} />
        <span>{t.menu.nudge}</span>
        <icons.ChevronRight size={14} class="arrow-icon" />
        
        <div class="submenu nudge-submenu" role="menu" data-testid="submenu-nudge">
          <div class="nudge-grid">
            <button class="nudge-btn" onclick={() => moveCardRelative(card, -3)} title="{t.menu.nudgeUp} (3)" data-testid="nudge-up">
              <icons.ChevronUp size={16} />
            </button>
            <div class="nudge-row">
              <button class="nudge-btn" onclick={() => moveCardRelative(card, -1)} title={t.menu.nudgeLeft} data-testid="nudge-left">
                <icons.ChevronLeft size={16} />
              </button>
              <button class="nudge-btn" onclick={() => moveCardRelative(card, 1)} title={t.menu.nudgeRight} data-testid="nudge-right">
                <icons.ChevronRight size={16} />
              </button>
            </div>
            <button class="nudge-btn" onclick={() => moveCardRelative(card, 3)} title="{t.menu.nudgeDown} (3)" data-testid="nudge-down">
              <icons.ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>

      <div class="divider" role="separator"></div>

      <button class="menu-item danger" onclick={() => handleAction(() => deleteCard(card))} role="menuitem" data-testid="menu-item-delete">
        <icons.Trash2 size={14} />
        <span>{t.menu.delete}</span>
      </button>

    {:else if isTab && tab}
      <!-- Tab Menu Items -->
      <button class="menu-item" onclick={() => handleAction(() => openTabSettings(tab))} role="menuitem" data-testid="menu-item-tab-settings">
        <icons.Settings size={14} />
        <span>{t.menu.tabSettings}</span>
      </button>

      <button class="menu-item" onclick={() => handleAction(() => duplicateTab(tab))} role="menuitem" data-testid="menu-item-tab-duplicate">
        <icons.CopyPlus size={14} />
        <span>{t.menu.tabDuplicate}</span>
      </button>

      <div class="divider" role="separator"></div>

      <button 
        class="menu-item danger" 
        class:disabled={tab.path === '__root__'}
        onclick={() => handleAction(() => deleteTab(tab))}
        role="menuitem"
        aria-disabled={tab.path === '__root__'}
        data-testid="menu-item-tab-delete"
      >
        <icons.Trash2 size={14} />
        <span>{t.menu.tabDelete}</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    width: 220px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    padding: 6px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    animation: menuAppear 0.1s ease-out;
    outline: none;
  }

  @keyframes menuAppear {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }

  .menu-header {
    padding: 8px 12px;
    font-size: 0.65rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid var(--color-surface-2);
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.8;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    text-align: left;
    font-family: inherit;
  }

  .menu-item:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .menu-item.danger {
    color: #ff5555;
  }

  .menu-item.danger:hover {
    background: rgba(255, 85, 85, 0.15);
  }

  .menu-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
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
    margin: 6px 0;
    opacity: 0.5;
  }

  /* Custom styling for icons inside menu items if needed */
  :global(.context-menu .arrow-icon) {
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
    border-radius: 12px;
    padding: 6px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  }

  /* Nudge controls */
  .nudge-submenu {
    width: auto;
    min-width: 120px;
  }
  .nudge-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 4px;
  }
  .nudge-row {
    display: flex;
    gap: 4px;
  }
  .nudge-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }
  .nudge-btn:hover {
    background: var(--color-accent-violet);
    color: white;
    border-color: transparent;
    transform: scale(1.1);
  }
</style>
