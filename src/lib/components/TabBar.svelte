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
    saveTabOrder,
  } from "../stores/appState.svelte";
  import { uiState } from "../stores/uiState.svelte";
  import { Plus, Search, X, CheckSquare } from "lucide-svelte";
  import * as icons from "lucide-svelte";
  import SearchInput from "./ui/SearchInput.svelte";
  import type { ComponentType } from "svelte";
  import type { Tab } from "../types";
  import { t } from "../i18n";
  import { logService } from "../services/logService.svelte";
  import { flip } from "svelte/animate";
  import IconRenderer from "./ui/IconRenderer.svelte";

  import { draggable, dropzone } from "../utils/dnd";

  const appState = getState();

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  }

  function clearSearch() {
    setSearchQuery("");
  }

  function getTabStyle(tab: Tab) {
    if (!tab.color) return undefined;
    return `--tab-color: ${tab.color}`;
  }

  function selectTabWithLog(index: number) {
    logService.log('ui', `TabBar: selectTab called for index ${index}`);
    selectTab(index);
  }

  function handleMove(fromIndex: number, toIndex: number) {
    if (appState.tabs[toIndex].path === "__root__") return;
    moveTab(fromIndex, toIndex);
  }

  /** Drag and Drop logic using shared actions */
  function handleDrop(fromIndex: number, toIndex: number) {
    logService.log('dnd', `TabBar: handleDrop from ${fromIndex} to ${toIndex}`);
    // Movement already happened during dragenter/onMove.
    // Just force save the final state immediately.
    saveTabOrder();
  }

  /** Context Menu for Tab */
  function handleContextMenu(e: MouseEvent, tab: Tab) {
    e.preventDefault();
    openContextMenu(e.clientX, e.clientY, tab as any); 
  }

  function handleTabClick(index: number, tab: Tab) {
    if (appState.activeTabIndex === index && tab.subfolders.length > 0) {
      const rect = document.getElementById(`tab-${index}`)?.getBoundingClientRect();
      if (rect) {
        openContextMenu(rect.left, rect.bottom, {
          type: 'subfolder-filter-menu',
          subfolders: tab.subfolders,
          activeFilter: uiState.activeSubfolderFilter,
          onSelect: (filter: string | 'all' | 'root') => {
            uiState.setActiveSubfolderFilter(filter);
          }
        } as any);
      }
    } else {
      selectTab(index);
    }
  }

  function handleAddTab(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(rect.left, rect.bottom, {
        type: 'add-tab-menu',
        onAddSnippets: () => {
            const name = prompt(t.tabs.add + " (folder name) - " + (t.tabs.typeSnippets || "Нотатки") + ":");
            if (name) createNewTab(name, 'snippets');
        },
        onAddKeyboard: () => {
            const name = prompt(t.tabs.add + " (folder name) - " + (t.tabs.typeKeyboard || "Клавіатура") + ":");
            if (name) createNewTab(name, 'keyboard');
        }
    } as any);
  }
</script>

{#if !appState.isMinimalMode}
  <div class="tab-bar-container">
    <div class="tab-bar" role="tablist" aria-label={t.app.title}>
      {#each appState.tabs as tab, i (tab.path)}
        {@const LucideIcon = getLucideIcon(tab.icon)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button
          class="tab"
          class:active={appState.activeTabIndex === i}
          class:has-custom-color={!!tab.color}
          role="tab"
          aria-selected={appState.activeTabIndex === i}
          aria-controls="app-main"
          id="tab-{i}"
          onclick={() => handleTabClick(i, tab)}
          oncontextmenu={(e) => handleContextMenu(e, tab)}
          style={getTabStyle(tab)}
          use:draggable={{ index: i, type: 'tab' }}
          use:dropzone={{ index: i, type: 'tab', onMove: handleMove, onDrop: handleDrop }}
          animate:flip={{ duration: 250 }}
          data-testid={`tab-button-${tab.path}`}
          data-tab-path={tab.path}
        >
          <span class="tab-hotkey" data-testid={`tab-hotkey-${tab.path}`}>
            {tab.hotkey ? appState.getHotkeyLabel(tab.hotkey) : (i + 1)}
          </span>

          <span class="tab-icon" data-testid={`tab-icon-${tab.path}`}>
            <IconRenderer icon={tab.icon} size={14} />
          </span>

          <span class="tab-name" data-testid={`tab-name-${tab.path}`}>{tab.name}</span>
          {#if tab.subfolders.length > 0}
            <icons.ChevronDown size={14} class="tab-chevron" data-testid={`tab-chevron-${tab.path}`} />
          {/if}
          <span class="tab-count" data-testid={`tab-count-${tab.path}`}>{tab.cards.length}</span>
        </button>
      {/each}

      <!-- Add Tab Button -->
      <button class="add-tab-btn" onclick={handleAddTab} title={t.tabs.add} data-testid="btn-add-tab">
        <Plus size={16} />
      </button>
    </div>

    <!-- Search Bar -->
    {#if appState.activeTab?.type !== 'keyboard'}
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
        <div class="search-field-outer">
          <SearchInput
            bind:value={uiState.searchQuery}
            placeholder={t.common.searchSnippets}
            testId="search-input"
          />
        </div>
      </div>
    {/if}
  </div>
{/if}

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
    background: var(--color-surface-1);
  }

  .tab.active {
    color: var(--color-text-primary);
    background: var(--color-surface-2);
  }

  .tab.active::after {
    width: 100%;
  }

  /* Drag and Drop visual feedback */
  :global(.tab.dragging) {
    opacity: 0.3 !important;
  }

  :global(.tab.drag-over) {
    background: var(--color-surface-3) !important;
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
    font-weight: 700;
    line-height: 1;
    border: 1px solid color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
  }

  .tab.active .tab-hotkey {
    background: var(--color-accent-cyan);
    color: var(--color-bg-primary);
    border-color: var(--color-accent-cyan);
  }

  .tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .tab-name {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }

  .tab.active .tab-name {
    color: var(--color-text-primary);
  }

  .tab-count {
    font-size: 0.75rem;
    opacity: 0.5;
    font-weight: 500;
    margin-left: -2px;
  }

  .tab.active .tab-count {
    opacity: 0.8;
  }

  :global(.tab-chevron) {
    margin-left: -4px;
    opacity: 0.4;
    transition: all 0.2s;
  }

  .tab:hover :global(.tab-chevron) {
    opacity: 0.7;
    transform: translateY(1px);
  }

  .tab.active :global(.tab-chevron) {
    opacity: 0.8;
    color: var(--tab-color, var(--color-accent-violet));
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
    box-shadow: var(--shadow-sm);
  }

  .add-tab-btn:active {
    transform: translateY(0) scale(0.95);
  }

  .search-container {
    display: flex;
    align-items: center;
    height: 100%;
    padding-bottom: 0;
    gap: 8px;
  }

  .selection-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
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
    background: color-mix(in srgb, var(--color-accent-cyan) 15%, transparent);
    border-color: var(--color-accent-cyan);
    color: var(--color-accent-cyan);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent-cyan) 20%, transparent);
  }

  .search-field-outer {
    width: 220px;
    transition: width 0.2s ease;
  }

  .search-field-outer:focus-within {
    width: 280px;
  }
</style>
