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
    setSearchQuery,
    toggleSelectionMode,
  } from "../stores/appState.svelte";
  import { Plus, Search, X, CheckSquare } from "lucide-svelte";
  import * as icons from "lucide-svelte";
  import type { ComponentType } from "svelte";
  import type { Tab } from "../types";
  import { t } from "../i18n";

  const appState = getState();

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  }

  function clearSearch() {
    setSearchQuery("");
  }

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
    openContextMenu(e.clientX, e.clientY, tab as any); 
  }

  function handleAddTab() {
    const name = prompt(t.tabs.add + " (folder name):");
    if (name) {
      createNewTab(name);
    }
  }
</script>

<div class="tab-bar-container">
  <div class="tab-bar" role="tablist" aria-label={t.app.title} data-testid="tab-bar">
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
        aria-controls="app-main"
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
        <span class="tab-hotkey" data-testid="tab-hotkey">
          {tab.hotkey ? appState.getHotkeyLabel(tab.hotkey) : (i + 1)}
        </span>

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
    <button class="add-tab-btn" onclick={handleAddTab} title={t.tabs.add} data-testid="btn-add-tab">
      <Plus size={16} />
    </button>
  </div>

  <!-- Search Bar -->
  <div class="search-container">
    <button 
      class="selection-toggle-btn" 
      class:active={appState.isSelectionMode}
      onclick={toggleSelectionMode}
      title={t.common.select || 'Вибрати'}
      data-testid="btn-selection-toggle"
    >
      <CheckSquare size={16} />
    </button>
    <div class="search-wrapper">
      <Search size={14} class="search-icon" />
      <input
        type="text"
        class="search-input"
        placeholder={t.common.search}
        value={appState.searchQuery}
        oninput={handleSearchInput}
        onkeydown={(e) => e.stopPropagation()}
        data-testid="search-input"
      />
      {#if appState.searchQuery}
        <button class="search-clear" onclick={clearSearch} title={t.common.cancel}>
          <X size={14} />
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .tab-bar-container {
    display: flex;
    align-items: flex-end; /* Align elements to the bottom to match tabs */
    padding: 0 var(--space-4);
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
    height: 48px; /* Fixed height for better control */
    gap: var(--space-4);
  }

  .tab-bar {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    flex: 1;
    align-items: flex-end;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
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
    height: 100%; /* Take full container height */
  }

  .tab::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 3px;
    background: var(--tab-color, var(--color-accent-violet));
    border-radius: 3px 3px 0 0;
    transition: width 0.25s ease;
  }

  .tab:hover {
    color: var(--color-text-secondary);
    background: rgba(255, 255, 255, 0.03);
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
    background: color-mix(in srgb, var(--tab-color) 12%, transparent);
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
    background: var(--tab-color, var(--color-accent-violet));
    color: white;
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
    font-size: 0.75rem;
    opacity: 0.4;
    font-weight: 400;
    margin-left: -2px;
  }

  .add-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 12px;
    margin-bottom: 7px; /* Fine-tuned alignment with tab text center */
    flex-shrink: 0;
  }

  .add-tab-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border-color: var(--color-border);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .add-tab-btn:active {
    transform: translateY(0) scale(0.95);
  }

  .search-container {
    display: flex;
    align-items: center;
    height: 100%;
    padding-bottom: 6px;
    gap: 8px;
  }

  .selection-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .selection-toggle-btn:hover {
    border-color: var(--color-accent-cyan);
    color: var(--color-text-primary);
    background: var(--color-surface-3);
  }

  .selection-toggle-btn.active {
    background: rgba(0, 210, 255, 0.15);
    border-color: var(--color-accent-cyan);
    color: var(--color-accent-cyan);
    box-shadow: 0 0 12px rgba(0, 210, 255, 0.2);
  }

  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0 10px;
    width: 220px;
    height: 32px;
    transition: all 0.2s ease;
  }

  .search-wrapper:focus-within {
    border-color: var(--color-accent-cyan);
    background: var(--color-surface-3);
    width: 280px;
    box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.1);
  }

  .search-wrapper :global(.search-icon) {
    color: var(--color-text-muted);
    margin-right: 8px;
    flex-shrink: 0;
  }

  .search-input {
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: 0.85rem;
    width: 100%;
    outline: none;
    padding: 0;
  }

  .search-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.6;
  }

  .search-clear {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    margin-right: -4px;
    transition: all 0.2s;
  }

  .search-clear:hover {
    background: var(--color-surface-1);
    color: var(--color-text-primary);
  }
</style>
