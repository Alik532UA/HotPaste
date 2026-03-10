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
  const isCard = $derived(contextMenu && contextMenu.card && "filePath" in (contextMenu.card as any));
  const isTab = $derived(contextMenu && contextMenu.card && "path" in (contextMenu.card as any));
  const isAddTabMenu = $derived(contextMenu && (contextMenu.card as any)?.type === 'add-tab-menu');
  
  // Casting for convenience
  const card = $derived(isCard ? (contextMenu?.card as unknown as Card) : null);
  const tab = $derived(isTab ? (contextMenu?.card as unknown as Tab) : null);
  const addTabMenu = $derived(isAddTabMenu ? (contextMenu?.card as any) : null);

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
      <span class="card-name" data-testid="menu-title">
        {#if isCard}{card?.name}{:else if isTab}{tab?.name}{:else if isAddTabMenu}{t.tabs.add}{:else}Menu{/if}
      </span>
    </div>

    {#if isAddTabMenu && addTabMenu}
      <button class="menu-item" onclick={() => handleAction(addTabMenu.onAddSnippets)} role="menuitem" data-testid="menu-item-add-snippets">
        <icons.Type size={14} />
        <span>{t.tabs.typeSnippets || "Нотатки"}</span>
      </button>
      <button class="menu-item" onclick={() => handleAction(addTabMenu.onAddKeyboard)} role="menuitem" data-testid="menu-item-add-keyboard">
        <icons.Keyboard size={14} />
        <span>{t.tabs.typeKeyboard || "Клавіатура"}</span>
      </button>

    {:else if isCard && card}
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
                <span>{#if t_item.icon}{t_item.icon}{:else}<icons.Folder size={14} />{/if} {t_item.name}</span>
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
    width: 230px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    box-shadow: var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 5%, transparent) inset;
    padding: 6px;
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    animation: menuAppear 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    outline: none;
  }

  @keyframes menuAppear {
    from { opacity: 0; transform: scale(0.95) translateY(-5px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .menu-header {
    padding: 10px 14px;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 6px;
    opacity: 0.9;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    text-align: left;
    font-family: inherit;
  }

  .menu-item:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    transform: translateX(4px);
  }

  .menu-item.danger {
    color: var(--color-danger);
  }

  .menu-item.danger:hover {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
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
    margin: 6px 8px;
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
    left: calc(100% + 2px);
    top: -6px;
    width: 190px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 6px;
    box-shadow: var(--shadow-lg);
    animation: menuAppear 0.2s ease-out;
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
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }
  .nudge-btn:hover {
    background: var(--color-accent-violet);
    color: white;
    border-color: var(--color-accent-violet);
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-violet) 40%, transparent);
  }
</style>
