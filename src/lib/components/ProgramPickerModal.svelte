<script lang="ts">
  import { X, Search, Monitor, Play, Folder, Settings2, Trash2, LayoutGrid, List } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { uiState } from "../stores/uiState.svelte";
  import { updateTabAssignment } from "../stores/appState.svelte";
  import { t } from "../i18n";
  import { logService } from "../services/logService.svelte";
  import { invoke } from "@tauri-apps/api/core";
  import type { ShortcutInfo } from "../types";
  import { onMount, untrack } from "svelte";

  const context = $derived(uiState.activeProgramPicker);
  let searchQuery = $state("");
  let activeTab = $state<"local" | "running" | "start" | "system">("running");
  let viewMode = $state<"grid" | "list">("grid");
  let programs = $state<ShortcutInfo[]>([]);
  let isLoading = $state(false);
  let icons = $state<Record<string, string>>({});

  const tabs = [
    { id: "local", label: t.modals.tabLocal, icon: Folder },
    { id: "running", label: t.modals.tabRunning, icon: Play },
    { id: "start", label: t.modals.tabStartMenu, icon: Settings2 },
    { id: "system", label: t.modals.tabSystem, icon: Monitor },
  ] as const;

  async function loadPrograms() {
    if (!context) return;
    isLoading = true;
    logService.info("icons", `Loading programs for tab: ${activeTab}`);
    try {
      let result: ShortcutInfo[] = [];
      switch (activeTab) {
        case "local":
          result = await invoke("get_local_shortcuts");
          break;
        case "running":
          result = await invoke("get_running_processes");
          break;
        case "start":
          result = await invoke("get_system_shortcuts");
          break;
        case "system":
          result = await invoke("get_system_apps");
          break;
      }
      programs = result;
      logService.info("icons", `Loaded ${result.length} programs. Starting icon loading...`);
      // Trigger chunked icon loading
      loadIconsChunked(result.map(p => p.path));
    } catch (err) {
      logService.error("icons", "Failed to load programs", err);
    } finally {
      isLoading = false;
    }
  }

  async function loadIconsChunked(paths: string[]) {
    if (paths.length === 0) return;
    
    // CRITICAL: CHUNK_SIZE MUST ALWAYS BE 1. 
    // Do not "optimize" this to a larger number. 
    // Icons must appear in the UI immediately one by one as they load.
    const CHUNK_SIZE = 1;
    const allPaths = [...paths];
    
    for (let i = 0; i < allPaths.length; i += CHUNK_SIZE) {
      const chunk = allPaths.slice(i, i + CHUNK_SIZE);
      logService.debug("icons", `Requesting icons chunk ${i/CHUNK_SIZE + 1}, size: ${chunk.length}`);
      
      try {
        const batch: [string, string][] = await invoke("get_shortcut_icons_batch", { paths: chunk });
        logService.debug("icons", `Received ${batch.length} icons for chunk ${i/CHUNK_SIZE + 1}`);
        
        // Update icons immediately
        const newIcons = { ...icons };
        batch.forEach(([path, b64]) => {
          newIcons[path] = `data:image/png;base64,${b64}`;
        });
        icons = newIcons;
      } catch (err) {
        logService.error("icons", `Failed to load chunk ${i/CHUNK_SIZE + 1}`, err);
      }
    }
    logService.info("icons", "Finished loading all icon chunks");
  }

  function handleSelect(prog: ShortcutInfo) {
    if (context) {
      updateTabAssignment(context.key, {
        name: prog.name,
        path: prog.path,
        type: activeTab,
        icon: prog.icon
      });
      handleClose();
    }
  }

  function handleClear() {
    if (context) {
      updateTabAssignment(context.key, 'none');
      handleClose();
    }
  }

  function handleClose() {
    uiState.closeProgramPicker();
  }

  $effect(() => {
    if (context && activeTab) {
      untrack(() => loadPrograms());
    }
  });

  const filteredPrograms = $derived(
    programs.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") handleClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if context}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop" 
    onmousedown={handleClose} 
    transition:fade={{ duration: 200 }}
  >
    <div 
        class="modal-content" 
        onmousedown={(e) => e.stopPropagation()} 
        transition:scale={{ duration: 300, start: 0.95 }}
    >
      <div class="modal-header">
        <div class="header-title">
          <Monitor size={20} />
          <h2>{t.modals.programPickerTitle}: {context.key}</h2>
        </div>
        <button class="btn-close" onclick={handleClose}>
          <X size={20} />
        </button>
      </div>

      <div class="tabs-bar">
        {#each tabs as tab}
          <button 
            class="tab-btn" 
            class:active={activeTab === tab.id}
            onclick={() => activeTab = tab.id}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="search-box">
        <div class="search-input-wrapper">
          <Search size={18} class="search-icon" />
          <input 
            type="text" 
            bind:value={searchQuery} 
            placeholder={t.modals.searchPrograms}
            spellcheck="false"
          />
          {#if searchQuery}
            <button 
              class="clear-search-btn" 
              onclick={() => searchQuery = ""}
              transition:fade={{ duration: 150 }}
              title={t.common.cancel}
            >
              <X size={14} />
            </button>
          {/if}
        </div>
        <div class="view-toggle">
          <button 
            class="view-btn" 
            class:active={viewMode === 'grid'} 
            onclick={() => viewMode = 'grid'}
            title={t.modals.viewGrid}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            class="view-btn" 
            class:active={viewMode === 'list'} 
            onclick={() => viewMode = 'list'}
            title={t.modals.viewList}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      <div class="modal-body">
        {#if isLoading}
          <div class="loading">{t.common.loading}</div>
        {:else if filteredPrograms.length === 0}
          <div class="empty">{t.modals.noPrograms}</div>
        {:else}
          <div class="program-container" class:grid-mode={viewMode === 'grid'} class:list-mode={viewMode === 'list'}>
            {#each filteredPrograms as prog}
              <button class="program-item" onclick={() => handleSelect(prog)} title={prog.path}>
                <div class="prog-icon">
                  {#if icons[prog.path]}
                    <img src={icons[prog.path]} alt="" />
                  {:else}
                    <div class="icon-placeholder"></div>
                  {/if}
                </div>
                <div class="prog-info">
                  <span class="prog-name">{prog.name}</span>
                  {#if viewMode === 'list'}
                    <span class="prog-path">{prog.path}</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-clear" onclick={handleClear}>
          <Trash2 size={16} />
          {t.common.disable}
        </button>
        <button class="btn-cancel" onclick={handleClose}>
          {t.common.cancel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    width: 100%;
    max-width: 90%;
    max-height: 85vh;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    transition: all 0.2s;
  }

  .btn-close:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .tabs-bar {
    display: flex;
    gap: 4px;
    padding: 12px 20px;
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .tab-btn.active {
    background: var(--color-accent-violet);
    color: white;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-border);
  }

  .search-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .search-input-wrapper input {
    width: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 40px 12px 42px;
    color: var(--color-text-primary);
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .search-input-wrapper input:focus {
    border-color: var(--color-accent-violet);
    background: var(--color-surface-3);
    box-shadow: 0 0 0 4px rgba(123, 97, 255, 0.1);
  }

  .clear-search-btn {
    position: absolute;
    right: 10px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-search-btn:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
  }

  .view-toggle {
    display: flex;
    background: var(--color-surface-1);
    padding: 2px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
  }

  .view-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-2);
  }

  .view-btn.active {
    background: var(--color-surface-3);
    color: var(--color-accent-cyan);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    min-height: 400px;
  }

  .loading, .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .program-container.list-mode {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .program-container.grid-mode {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .program-item {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    overflow: hidden;
  }

  .program-item:hover {
    background: var(--color-surface-2);
    border-color: var(--color-accent-violet);
    transform: translateY(-2px);
  }

  /* List Item Style */
  .list-mode .program-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
  }

  /* Grid Item Style */
  .grid-mode .program-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 12px;
    gap: 12px;
    text-align: center;
  }

  .prog-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .list-mode .prog-icon {
    width: 36px;
    height: 36px;
  }

  .grid-mode .prog-icon {
    width: 64px;
    height: 64px;
  }

  .prog-icon img {
    width: 70%;
    height: 70%;
    object-fit: contain;
  }

  .icon-placeholder {
    width: 50%;
    height: 50%;
    background: var(--color-surface-3);
    border-radius: 4px;
    opacity: 0.5;
  }

  .prog-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: 100%;
  }

  .prog-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prog-path {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    background: var(--color-surface-1);
  }

  .btn-clear {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 75, 75, 0.1);
    border: 1px solid rgba(255, 75, 75, 0.2);
    border-radius: 12px;
    color: #ff4b4b;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-clear:hover {
    background: rgba(255, 75, 75, 0.2);
    border-color: #ff4b4b;
  }

  .btn-cancel {
    padding: 10px 24px;
    background: var(--color-surface-3);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    color: var(--color-text-primary);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: var(--color-surface-2);
  }
</style>