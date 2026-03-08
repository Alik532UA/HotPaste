<script lang="ts">
  import {
    getState,
    connectDirectory,
    selectTab,
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
    // We can use the custom color for the active underline or hover state
    return `--tab-color: ${tab.color}`;
  }
</script>

<div class="tab-bar" role="tablist" aria-label="Вкладки сніпетів">
  {#each appState.tabs as tab, i}
    {@const LucideIcon = getLucideIcon(tab.icon)}
    <button
      class="tab"
      class:active={appState.activeTabIndex === i}
      class:has-custom-color={!!tab.color}
      role="tab"
      aria-selected={appState.activeTabIndex === i}
      id="tab-{i}"
      onclick={() => selectTab(i)}
      style={getTabStyle(tab)}
    >
      {#if tab.hotkey}
        <span class="tab-hotkey">{tab.hotkey}</span>
      {/if}

      {#if LucideIcon}
        <span class="tab-icon"><LucideIcon size={14} /></span>
      {:else if tab.icon}
        <span class="tab-icon emoji">{tab.icon}</span>
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
</style>
