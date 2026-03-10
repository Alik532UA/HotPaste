<script lang="ts">
  import { X, Search, Monitor, Play, Folder, Settings2, Trash2, LayoutGrid, List, Link, Terminal, Power, RotateCcw, Moon, Zap, Lock, LogOut } from "lucide-svelte";
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
  let activeTab = $state<"local" | "running" | "start" | "system" | "url" | "commands">("running");
  let viewMode = $state<"grid" | "list">("grid");
  let customUrl = $state("");
  let customCommand = $state("");
  let programs = $state<ShortcutInfo[]>([]);
  let isLoading = $state(false);
  let icons = $state<Record<string, string>>({});

  const SYSTEM_COMMANDS: ShortcutInfo[] = [
    { name: "Shutdown", path: "shutdown /s /t 0", icon: "power" },
    { name: "Restart", path: "shutdown /r /t 0", icon: "rotate-ccw" },
    { name: "Sleep", path: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0", icon: "moon" },
    { name: "Hibernate", path: "shutdown /h", icon: "zap" },
    { name: "Lock", path: "rundll32.exe user32.dll,LockWorkStation", icon: "lock" },
    { name: "Log off", path: "shutdown /l", icon: "log-out" },
  ];

  const COMMAND_ICONS: Record<string, any> = {
    "power": Power,
    "rotate-ccw": RotateCcw,
    "moon": Moon,
    "zap": Zap,
    "lock": Lock,
    "log-out": LogOut
  };

  const tabs = [
    { id: "local", label: "Local", icon: Folder },
    { id: "running", label: "Running", icon: Play },
    { id: "start", label: "Start", icon: Settings2 },
    { id: "system", label: "System", icon: Monitor },
    { id: "url", label: "URL", icon: Link },
    { id: "commands", label: "Commands", icon: Terminal },
  ] as const;

  async function loadPrograms() {
    if (!context) return;
    if (activeTab === "url" || activeTab === "commands") {
        programs = activeTab === "commands" ? SYSTEM_COMMANDS : [];
        isLoading = false;
        return;
    }
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
    const CHUNK_SIZE = 1;
    const allPaths = [...paths];
    for (let i = 0; i < allPaths.length; i += CHUNK_SIZE) {
      const chunk = allPaths.slice(i, i + CHUNK_SIZE);
      try {
        const batch: [string, string][] = await invoke("get_shortcut_icons_batch", { paths: chunk });
        const newIcons = { ...icons };
        batch.forEach(([path, b64]) => {
          newIcons[path] = `data:image/png;base64,${b64}`;
        });
        icons = newIcons;
      } catch (err) {
        logService.error("icons", `Failed to load chunk`, err);
      }
    }
  }

  function handleSelect(prog: ShortcutInfo) {
    if (context) {
      const fullIconData = icons[prog.path] || "";
      const base64Icon = fullIconData.startsWith("data:") ? fullIconData.split(",")[1] : fullIconData;
      updateTabAssignment(context.key, {
        name: prog.name,
        path: prog.path,
        type: activeTab as any,
        icon: base64Icon || (prog.icon ? `lucide:${prog.icon}` : null)
      });
      handleClose();
    }
  }

  function handleAddUrl() {
    if (context && customUrl.trim()) {
        let url = customUrl.trim();
        logService.info("ui", `Adding URL: ${url} to key: ${context.key}`);
        if (!url.startsWith('http') && !url.includes('://')) {
            url = 'https://' + url;
        }
        updateTabAssignment(context.key, {
            name: customUrl.trim(),
            path: url,
            type: 'url',
            icon: 'lucide:link'
        });
        customUrl = "";
        handleClose();
    }
  }

  function handleAddCustomCommand() {
    if (context && customCommand) {
        updateTabAssignment(context.key, {
            name: customCommand,
            path: customCommand,
            type: 'commands',
            icon: 'lucide:terminal'
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
    data-testid="program-picker-backdrop"
  >
    <div 
        class="modal-content" 
        class:minimal-layout={uiState.isMinimalMode}
        onmousedown={(e) => e.stopPropagation()} 
        transition:scale={{ duration: 300, start: 0.95 }}
        data-testid="program-picker-modal"
    >
      <div class="modal-header">
        <div class="header-title" data-testid="program-picker-header-title">
          <Monitor size={uiState.isMinimalMode ? 16 : 20} />
          <h2>{t.modals.programPickerTitle}: {context.key}</h2>
        </div>
        <button class="btn-close" onclick={handleClose} data-testid="btn-close-program-picker">
          <X size={uiState.isMinimalMode ? 16 : 20} />
        </button>
      </div>

      <div class="tabs-bar" data-testid="program-picker-tabs">
        {#each tabs as tab}
          <button 
            class="tab-btn" 
            class:active={activeTab === tab.id}
            onclick={() => activeTab = tab.id}
            data-testid="tab-btn-{tab.id}"
          >
            <tab.icon size={uiState.isMinimalMode ? 14 : 16} />
            <span class="tab-label">{tab.label}</span>
          </button>
        {/each}
      </div>

      <div class="search-box">
        <div class="search-input-wrapper">
          <Search size={uiState.isMinimalMode ? 16 : 18} class="search-icon" />
          <input 
            type="text" 
            bind:value={searchQuery} 
            placeholder={t.modals.searchPrograms}
            spellcheck="false"
            data-testid="input-program-search"
            onkeydown={(e) => e.stopPropagation()}
          />
          {#if searchQuery}
            <button 
              class="clear-search-btn" 
              onclick={() => searchQuery = ""}
              transition:fade={{ duration: 150 }}
              title={t.common.cancel}
              data-testid="btn-clear-program-search"
            >
              <X size={12} />
            </button>
          {/if}
        </div>
        <div class="view-toggle">
          <button class="view-btn" class:active={viewMode === 'grid'} onclick={() => viewMode = 'grid'} data-testid="btn-view-grid">
            <LayoutGrid size={uiState.isMinimalMode ? 16 : 18} />
          </button>
          <button class="view-btn" class:active={viewMode === 'list'} onclick={() => viewMode = 'list'} data-testid="btn-view-list">
            <List size={uiState.isMinimalMode ? 16 : 18} />
          </button>
        </div>
      </div>

      <div class="modal-body" data-testid="program-picker-body">
        {#if activeTab === 'url'}
          <div class="custom-input-section" in:fade data-testid="section-custom-url">
            <div class="section-icon"><Link size={uiState.isMinimalMode ? 32 : 48} /></div>
            <h3>Add Custom URL</h3>
            {#if !uiState.isMinimalMode}<p>Enter a website address or a custom protocol link</p>{/if}
            <div class="input-group">
                <input 
                  type="text" 
                  bind:value={customUrl} 
                  placeholder="example.com" 
                  spellcheck="false" 
                  data-testid="input-custom-url"
                  onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleAddUrl(); }} 
                />
                <button class="btn-add" onclick={handleAddUrl} disabled={!customUrl} data-testid="btn-add-custom-url">Add</button>
            </div>
          </div>
        {:else if activeTab === 'commands'}
          <div class="commands-section" in:fade data-testid="section-system-commands">
            <div class="program-container grid-mode">
                {#each SYSTEM_COMMANDS as cmd}
                  <button class="program-item grid-mode" onclick={() => handleSelect(cmd)} data-testid="program-item-{cmd.name}">
                    <div class="prog-icon command-icon" data-testid="prog-icon-{cmd.name}">
                        {#if COMMAND_ICONS[cmd.icon || '']}
                            {@const Icon = COMMAND_ICONS[cmd.icon || '']}
                            <Icon size={uiState.isMinimalMode ? 24 : 32} />
                        {/if}
                    </div>
                    <span class="prog-name" data-testid="prog-name-{cmd.name}">{cmd.name}</span>
                  </button>
                {/each}
            </div>
            <div class="custom-command-box" data-testid="box-custom-command">
                <h4>Custom Command</h4>
                <div class="input-group">
                    <input 
                      type="text" 
                      bind:value={customCommand} 
                      placeholder="e.g. ms-settings:colors" 
                      spellcheck="false" 
                      data-testid="input-custom-command"
                      onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleAddCustomCommand(); }} 
                    />
                    <button class="btn-add" onclick={handleAddCustomCommand} disabled={!customCommand} data-testid="btn-add-custom-command">Add</button>
                </div>
            </div>
          </div>
        {:else if isLoading}
          <div class="loading" data-testid="program-picker-loading">{t.common.loading}</div>
        {:else if filteredPrograms.length === 0}
          <div class="empty" data-testid="program-picker-empty">{t.modals.noPrograms}</div>
        {:else}
          <div class="program-container" class:grid-mode={viewMode === 'grid'} class:list-mode={viewMode === 'list'} data-testid="program-container-list">
            {#each filteredPrograms as prog}
              <button class="program-item" onclick={() => handleSelect(prog)} title={prog.path} data-testid="program-item-{prog.name}">
                <div class="prog-icon" data-testid="prog-icon-{prog.name}">
                  {#if icons[prog.path]}<img src={icons[prog.path]} alt="" />{:else}<div class="icon-placeholder"></div>{/if}
                </div>
                <div class="prog-info" data-testid="prog-info-{prog.name}">
                  <span class="prog-name" data-testid="prog-name-{prog.name}">{prog.name}</span>
                  {#if viewMode === 'list'}
                    <span class="prog-path" data-testid="prog-path-{prog.name}">{prog.path}</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-clear" onclick={handleClear} data-testid="btn-clear-assignment">
          <Trash2 size={16} />
          {uiState.isMinimalMode ? "" : t.common.disable}
        </button>
        <button class="btn-cancel" onclick={handleClose} data-testid="btn-cancel-program-picker">{t.common.cancel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, black 70%, transparent);
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
    max-height: 90vh;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-content.minimal-layout {
    max-height: 95vh;
    max-width: 98%;
    border-radius: 12px;
  }

  .modal-header {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
  }

  .minimal-layout .modal-header {
    padding: 10px 16px;
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

  .minimal-layout .header-title h2 {
    font-size: 0.9rem;
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

  .tabs-bar {
    display: flex;
    gap: 4px;
    padding: 12px 20px;
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
  }

  .minimal-layout .tabs-bar {
    padding: 6px 10px;
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

  .minimal-layout .tab-btn {
    padding: 6px 4px;
    gap: 4px;
    font-size: 0.7rem;
  }

  @media (max-width: 500px) {
    .minimal-layout .tab-label { display: none; }
  }

  .tab-btn.active {
    background: var(--color-accent-violet);
    color: #1a1d23;
  }

  :global([data-theme="light-gray"]) .tab-btn.active,
  :global([data-theme="green"]) .tab-btn.active {
    color: white;
  }

  .custom-input-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
    gap: 16px;
  }

  .minimal-layout .custom-input-section {
    padding: 20px;
    gap: 10px;
  }

  .section-icon {
    color: var(--color-accent-violet);
    background: var(--color-surface-2);
    width: 96px;
    height: 96px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .minimal-layout .section-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  .input-group {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 400px;
  }

  .input-group input {
    flex: 1;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--color-text-primary);
    outline: none;
  }

  .minimal-layout .input-group input {
    padding: 8px 12px;
    font-size: 0.85rem;
  }

  .btn-add {
    background: var(--color-accent-violet);
    color: #1a1d23;
    border: none;
    border-radius: 12px;
    padding: 0 20px;
    font-weight: 700;
    cursor: pointer;
  }

  .commands-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .minimal-layout .commands-section {
    gap: 12px;
  }

  .custom-command-box {
    border-top: 1px solid var(--color-border);
    padding-top: 16px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--color-border);
  }

  .minimal-layout .search-box {
    padding: 10px 16px;
    gap: 8px;
  }

  .search-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 0 12px;
  }

  .search-input-wrapper input {
    width: 100%;
    background: transparent;
    border: none;
    padding: 12px 10px;
    color: var(--color-text-primary);
    outline: none;
  }

  .minimal-layout .search-input-wrapper input {
    padding: 8px 6px;
    font-size: 0.85rem;
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
  }

  .minimal-layout .view-btn {
    width: 28px;
    height: 28px;
  }

  .view-btn.active {
    background: var(--color-surface-3);
    color: var(--color-accent-cyan);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    min-height: 0;
  }

  .minimal-layout .modal-body {
    padding: 12px 16px;
    height: 300px;
    max-height: calc(100vh - 180px);
  }

  .program-container.grid-mode {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .program-container.list-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .minimal-layout .program-container.grid-mode {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .program-item {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    overflow: hidden;
    min-width: 0; /* Crucial for ellipsis in grid/flex */
  }

  .list-mode .program-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 12px;
  }

  .grid-mode .program-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 12px;
    gap: 12px;
    text-align: center;
  }

  .minimal-layout .grid-mode .program-item {
    padding: 10px 8px;
    gap: 6px;
  }

  .prog-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, black 20%, transparent);
    border-radius: 10px;
    width: 64px;
    height: 64px;
    flex-shrink: 0;
  }

  .list-mode .prog-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
  }

  .minimal-layout .grid-mode .prog-icon {
    width: 40px;
    height: 40px;
  }

  .prog-icon img { width: 70%; height: 70%; object-fit: contain; }

  .prog-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    flex: 1;
    width: 100%; /* Ensure it fills parent in grid mode */
  }

  .prog-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    display: block; /* Span needs block for ellipsis */
  }

  .prog-path {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    display: block;
  }

  .minimal-layout .prog-name { font-size: 0.8rem; }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    background: var(--color-surface-1);
  }

  .minimal-layout .modal-footer { padding: 10px 16px; }

  .btn-clear {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    color: var(--color-danger);
    font-weight: 600;
    cursor: pointer;
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
</style>