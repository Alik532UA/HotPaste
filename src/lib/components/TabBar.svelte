<script lang="ts">
  import {
    getState,
    selectTab,
    openTabSettings,
    deleteTab,
    duplicateTab,
    createNewTab,
    moveTab,
    openContextMenu,
  } from "../stores/appState.svelte";
  import * as icons from "lucide-svelte";
  import type { ComponentType } from "svelte";
  import type { Tab } from "../types";

  const appState = getState();

  function getLucideIcon(iconName: string | null): ComponentType | null {
    if (!iconName || iconName.length <= 2) return null;
    return (
      (icons[iconName as keyof typeof icons] as ComponentType | undefined) ||
      null
    );
  }

  function getTabStyle(tab: Tab) {
    if (!tab.color) return undefined;
    return `--tab-color: ${tab.color}`;
  }

  /** Drag and Drop logic */
  let draggedTabIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function handleDragStart(e: DragEvent, index: number) {
    if (appState.tabs[index].path === "__root__") {
      e.preventDefault();
      return;
    }
    draggedTabIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedTabIndex === null || draggedTabIndex === index) return;
    if (appState.tabs[index].path === "__root__") return;
    dragOverIndex = index;
  }

  function handleDrop(e: DragEvent, toIndex: number) {
    e.preventDefault();
    if (draggedTabIndex !== null && draggedTabIndex !== toIndex) {
      moveTab(draggedTabIndex, toIndex);
    }
    draggedTabIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedTabIndex = null;
    dragOverIndex = null;
  }

  /** Context Menu for Tab */
  function handleContextMenu(e: MouseEvent, tab: Tab) {
    e.preventDefault();
    // Custom context menu logic for tabs
    // For now, we reuse the store's openContextMenu but we need to tell it it's a tab
    // Or we just call openTabSettings directly if we want simple
    // But user asked for context menu on tabs.
    // I will pass the tab as a special object to openContextMenu
    openContextMenu(e.clientX, e.clientY, tab as any); 
  }

  function handleAddTab() {
    const name = prompt("Введіть назву нової вкладки (назва папки):");
    if (name) {
      createNewTab(name);
    }
  }
</script>

<div class="tab-bar-container">
  <div class="tab-bar" role="tablist" aria-label="Вкладки сніпетів" data-testid="tab-bar">
    {#each appState.tabs as tab, i (tab.path)}
      {@const LucideIcon = getLucideIcon(tab.icon)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <button
        class="tab"
        class:active={appState.activeTabIndex === i}
        class:has-custom-color={!!tab.color}
        class:drag-over={dragOverIndex === i}
        class:is-dragging={draggedTabIndex === i}
        role="tab"
        aria-selected={appState.activeTabIndex === i}
        id="tab-{i}"
        onclick={() => selectTab(i)}
        oncontextmenu={(e) => handleContextMenu(e, tab)}
        style={getTabStyle(tab)}
        draggable={tab.path !== "__root__"}
        ondragstart={(e) => handleDragStart(e, i)}
        ondragover={(e) => handleDragOver(e, i)}
        ondragleave={() => (dragOverIndex = null)}
        ondrop={(e) => handleDrop(e, i)}
        ondragend={handleDragEnd}
        data-testid="tab-button"
        data-tab-path={tab.path}
      >
        {#if tab.hotkey}
          <span class="tab-hotkey" data-testid="tab-hotkey">{tab.hotkey}</span>
        {/if}

        {#if LucideIcon}
          <span class="tab-icon" data-testid="tab-icon"><LucideIcon size={14} /></span>
        {:else if tab.icon}
          <span class="tab-icon emoji" data-testid="tab-icon-emoji">{tab.icon}</span>
        {/if}

        <span class="tab-name" data-testid="tab-name">{tab.name}</span>
        <span class="tab-count" data-testid="tab-count">{tab.cards.length}</span>
      </button>
    {/each}

    <!-- Add Tab Button -->
    <button class="add-tab-btn" onclick={handleAddTab} title="Створити нову вкладку" data-testid="btn-add-tab">
      <icons.Plus size={16} />
    </button>
  </div>
</div>

<style>
  .tab-bar-container {
    display: flex;
    align-items: center;
    padding: 0 var(--space-4);
    background: var(--color-surface-1);
  }

  .tab-bar {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    flex: 1;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-family);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 10px 10px 0 0;
    transition: all 0.2s ease;
    white-space: nowrap;
    position: relative;
    flex-shrink: 0;
    user-select: none;
  }

  .tab::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--tab-color, var(--color-accent-gradient));
    border-radius: 2px 2px 0 0;
    transition: width 0.25s ease;
  }

  .tab:hover {
    color: var(--color-text-secondary);
    background: var(--color-surface-2);
  }

  .tab.active {
    color: var(--color-text-primary);
    background: var(--color-surface-2);
  }

  .tab.active::after {
    width: 100%;
  }

  .tab.is-dragging {
    opacity: 0.4;
  }

  .tab.drag-over {
    background: var(--color-surface-3);
    border-radius: 10px;
  }

  /* Custom Color tab styles */
  .tab.has-custom-color.active {
    background: color-mix(in srgb, var(--tab-color) 10%, transparent);
    color: var(--tab-color);
  }

  .tab-hotkey {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 6px;
    background: var(--color-surface-3);
    color: var(--color-accent-cyan);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1;
  }

  .tab.active .tab-hotkey {
    background: var(--tab-color, var(--color-accent-gradient));
    color: var(--color-bg-primary);
  }

  .tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tab-icon.emoji {
    font-size: 1rem;
  }

  .tab-name {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-count {
    font-size: 0.7rem;
    opacity: 0.5;
    font-weight: 400;
  }

  .add-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
    margin-left: 8px;
  }

  .add-tab-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }
</style>
