<script lang="ts">
  import {
    getState,
    connectDirectory,
    selectTab,
  } from "../stores/appState.svelte";

  const state = getState();
</script>

<div class="tab-bar" role="tablist" aria-label="Вкладки сніпетів">
  {#each state.tabs as tab, i}
    <button
      class="tab"
      class:active={state.activeTabIndex === i}
      role="tab"
      aria-selected={state.activeTabIndex === i}
      id="tab-{i}"
      onclick={() => selectTab(i)}
    >
      {#if tab.hotkey}
        <span class="tab-hotkey">{tab.hotkey}</span>
      {/if}
      <span class="tab-name">{tab.name}</span>
      <span class="tab-count">{tab.cards.length}</span>
    </button>
  {/each}
</div>

<style>
  .tab-bar {
    display: flex;
    gap: 4px;
    padding: 0 var(--space-4);
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-surface-3) transparent;
    -webkit-overflow-scrolling: touch;
  }

  .tab-bar::-webkit-scrollbar {
    height: 3px;
  }

  .tab-bar::-webkit-scrollbar-track {
    background: transparent;
  }

  .tab-bar::-webkit-scrollbar-thumb {
    background: var(--color-surface-3);
    border-radius: 2px;
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
  }

  .tab::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--color-accent-gradient);
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
    background: var(--color-accent-gradient);
    color: var(--color-bg-primary);
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
</style>
