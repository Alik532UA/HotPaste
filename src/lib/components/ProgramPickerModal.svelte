<script lang="ts">
  import { X, Search, Monitor, Play, Settings2, Power, RotateCcw, Moon, Zap, Lock, LogOut, Link, Terminal, Check, Info, LayoutGrid, List, Trash2, Download, Music, Video, Image, User, Network, PanelsTopLeft, Type, EyeOff, Folder, FolderOpen } from "lucide-svelte";
  import { getState, updateTabAssignment, openIconPicker } from "../stores/appState.svelte";
  import SearchInput from "./ui/SearchInput.svelte";
  import IconRenderer from "./ui/IconRenderer.svelte";
  import { t } from "../i18n";
  import type { ShortcutInfo } from "../types";
  import { logService } from "../services/logService.svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { iconService } from "../services/iconService.svelte";
  import { uiState } from "../stores/uiState.svelte";
  import { fade, scale, fly } from "svelte/transition";
  import { untrack } from "svelte";

  const context = $derived(uiState.activeProgramPicker);
  let searchQuery = $state("");
  let activeTab = $state<"local" | "running" | "start" | "system" | "url" | "commands">("running");
  let viewMode = $state<"grid" | "list">("grid");
  
  // Draft state for current selection
  let selectedProg = $state<ShortcutInfo | null>(null);
  let customUrl = $state("");
  let customCommand = $state("");
  
  let programs = $state<ShortcutInfo[]>([]);
  let isLoading = $state(false);
  let icons = $state<Record<string, string>>({});

  const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

  async function openLocalFolder() {
    try {
        await invoke("open_local_shortcuts_folder");
    } catch (err) {
        logService.error("app", "Failed to open local folder", err);
    }
  }

  const SYSTEM_COMMANDS: ShortcutInfo[] = [
    { name: "Shutdown", path: "shutdown /s /t 0", icon: "power" },
    { name: "Restart", path: "shutdown /r /t 0", icon: "rotate-ccw" },
    { name: "Sleep", path: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0", icon: "moon" },
    { name: "Hibernate", path: "shutdown /h", icon: "zap" },
    { name: "Lock", path: "rundll32.exe user32.dll,LockWorkStation", icon: "lock" },
    { name: "Log off", path: "shutdown /l", icon: "log-out" },
  ];

  const SYSTEM_FOLDERS: ShortcutInfo[] = [
    { name: "Documents", path: "Documents", icon: "folder" },
    { name: "Downloads", path: "Downloads", icon: "download" },
    { name: "Music", path: "Music", icon: "music" },
    { name: "Videos", path: "Videos", icon: "video" },
    { name: "Pictures", path: "Pictures", icon: "image" },
    { name: "Personal Folder", path: ".", icon: "user" },
    { name: "File Explorer", path: "explorer", icon: "monitor" },
    { name: "Settings", path: "ms-settings:", icon: "settings" },
    { name: "Control Panel", path: "control", icon: "layout-grid" },
    { name: "Network", path: "shell:NetworkPlacesFolder", icon: "network" },
  ];

  const COMMAND_ICONS: Record<string, any> = {
    "power": Power,
    "rotate-ccw": RotateCcw,
    "moon": Moon,
    "zap": Zap,
    "lock": Lock,
    "log-out": LogOut,
    "folder": Folder,
    "download": Download,
    "music": Music,
    "video": Video,
    "image": Image,
    "user": User,
    "monitor": Monitor,
    "settings": Settings2,
    "layout-grid": LayoutGrid,
    "network": Network
  };

  const tabs = [
    { id: "local", label: "Local", icon: Folder },
    { id: "running", label: "Running", icon: Play },
    { id: "start", label: "Start", icon: Settings2 },
    { id: "system", label: "System", icon: Monitor },
    { id: "url", label: "URL", icon: Link },
    { id: "commands", label: "Commands", icon: Terminal },
  ] as const;

  const displayModes = [
    { id: 'both', label: 'Іконка + Текст', icon: PanelsTopLeft },
    { id: 'icon', label: 'Тільки іконка', icon: Image },
    { id: 'text', label: 'Тільки текст', icon: Type },
    { id: 'none', label: 'Приховати', icon: EyeOff },
  ] as const;

  async function loadPrograms() {
    if (!context) return;
    if (activeTab === "url" || activeTab === "commands") {
        programs = activeTab === "commands" ? [...SYSTEM_COMMANDS, ...SYSTEM_FOLDERS] : [];
        isLoading = false;
        return;
    }
    
    if (!isTauri) {
      logService.info("icons", `Skipping program load (Not in Tauri environment)`);
      programs = [];
      isLoading = false;
      return;
    }

    isLoading = true;
    try {
      let result: ShortcutInfo[] = [];
      switch (activeTab) {
        case "local": result = await invoke<ShortcutInfo[]>("get_local_shortcuts"); break;
        case "running": result = await invoke<ShortcutInfo[]>("get_running_processes"); break;
        case "start": result = await invoke<ShortcutInfo[]>("get_system_shortcuts"); break;
        case "system": result = await invoke<ShortcutInfo[]>("get_system_apps"); break;
      }
      programs = result;
      loadIconsChunked(result.map(p => p.path));
    } catch (err) {
      logService.error("icons", "Failed to load programs", err);
    } finally {
      isLoading = false;
    }
  }

  async function loadIconsChunked(paths: string[]) {
    if (paths.length === 0 || !isTauri) return;
    const CHUNK_SIZE = 5;
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
        logService.error("icons", `Failed to load icons`, err);
      }
    }
  }

  async function prepareSelection(prog: ShortcutInfo) {
    const iconData = icons[prog.path] || "";
    let finalIcon = prog.icon ? `lucide:${prog.icon}` : null;
    
    if (iconData.startsWith("data:")) {
      finalIcon = iconData;
    }

    selectedProg = {
      ...prog,
      icon: finalIcon,
      displayMode: prog.displayMode || 'icon',
      customLabel: prog.customLabel || prog.name,
      confirmCount: prog.confirmCount || 1
    };
  }

  async function handleConfirm() {
    if (context && selectedProg) {
      let finalIcon = selectedProg.icon;
      
      if (finalIcon?.startsWith("data:")) {
        finalIcon = await iconService.saveBase64Icon(finalIcon, selectedProg.name);
      }

      updateTabAssignment(context.key, {
        name: selectedProg.name,
        path: selectedProg.path,
        type: activeTab as any,
        icon: finalIcon,
        displayMode: selectedProg.displayMode,
        customLabel: selectedProg.customLabel,
        confirmCount: selectedProg.confirmCount || 1
      });
      handleClose();
    }
  }

  function handleAddUrl() {
    if (context && customUrl.trim()) {
        let url = customUrl.trim();
        if (!url.startsWith('http') && !url.includes('://')) {
            url = 'https://' + url;
        }
        prepareSelection({
            name: customUrl.trim(),
            path: url,
            type: 'url',
            icon: 'lucide:Link',
            confirmCount: 1
        });
    }
  }

  function handleAddCustomCommand() {
    if (context && customCommand) {
        prepareSelection({
            name: customCommand,
            path: customCommand,
            type: 'commands',
            icon: 'lucide:Terminal',
            confirmCount: 1
        });
    }
  }

  function openDraftIconPicker() {
    if (!selectedProg) return;
    openIconPicker(selectedProg.icon || "", (v) => {
        if (selectedProg) selectedProg.icon = v;
    });
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
      untrack(() => {
        loadPrograms();
        if (selectedProg && selectedProg.type !== activeTab) {
            selectedProg = null;
        }
      });
    }
  });

  $effect(() => {
      if (context) {
          untrack(() => {
            const assignment = context.tab.assignments?.[context.key];
            if (assignment) {
                activeTab = (assignment.type as any) || "running";
                selectedProg = { 
                    ...assignment,
                    confirmCount: assignment.confirmCount || 1
                };
            } else {
                activeTab = "running";
                selectedProg = null;
            }
          });
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

{#snippet iconButton(icon: string | null | undefined, onclick: () => void, size: 'sm' | 'md' | 'lg' = 'md')}
    <button 
        class="icon-edit-btn size-{size}" 
        onclick={onclick} 
        title="Змінити іконку" 
        type="button"
    >
        <IconRenderer {icon} size={size === 'sm' ? 24 : size === 'md' ? 32 : 48} />
        <div class="edit-overlay"><Settings2 size={size === 'sm' ? 12 : 16} /></div>
    </button>
{/snippet}

{#snippet skeleton()}
  <div class="program-container grid-mode">
    {#each Array(12) as _}
      <div class="program-item skeleton-item">
        <div class="prog-icon skeleton-bg"></div>
        <div class="prog-info">
          <div class="skeleton-line skeleton-bg" style="width: 80%; height: 14px; margin-bottom: 8px; border-radius: 4px;"></div>
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet section(title: string, items: ShortcutInfo[])}
    {@const filtered = items.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.path.toLowerCase().includes(searchQuery.toLowerCase())
    )}
    {#if filtered.length > 0}
        <div class="section-block">
            <h4>{title}</h4>
            <div class="program-container grid-mode">
                {#each filtered as item}
                    <button class="program-item grid-mode" onclick={() => prepareSelection(item)} type="button">
                        <div class="prog-icon command-icon">
                            {#if COMMAND_ICONS[item.icon || '']}
                                {@const Icon = COMMAND_ICONS[item.icon || '']}
                                <Icon size={32} />
                            {/if}
                        </div>
                        <span class="prog-name">{item.name}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}
{/snippet}

{#snippet inspector()}
    <div class="inspector-panel">
      {#if selectedProg}
        <div class="inspector-content" in:fly={{ y: 10, duration: 200 }}>
            <div class="inspector-header">
                {@render iconButton(selectedProg.icon, openDraftIconPicker, 'lg')}
                <div class="draft-details">
                    <div class="input-field">
                        <label for="custom-label">Назва для клавіатури</label>
                        <input 
                            id="custom-label"
                            type="text" 
                            bind:value={selectedProg.customLabel} 
                            placeholder="Введіть назву..."
                            spellcheck="false"
                        />
                    </div>
                    <span class="draft-path" title={selectedProg.path}>{selectedProg.path}</span>
                </div>
            </div>

            <div class="inspector-settings">
                <div class="setting-group">
                    <span class="label-text">Режим відображення</span>
                    <div class="mode-grid">
                        {#each displayModes as mode}
                            <button 
                                class="mode-btn" 
                                class:active={selectedProg?.displayMode === mode.id}
                                onclick={() => { if (selectedProg) selectedProg.displayMode = mode.id; }}
                                type="button"
                            >
                                <mode.icon size={18} />
                                <span>{mode.label}</span>
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="setting-group" style="margin-top: 16px;">
                    <label for="confirm-count">Кількість натискань для активації</label>
                    <div class="number-input-row">
                        <input 
                            id="confirm-count"
                            type="number" 
                            min="1" 
                            max="10"
                            bind:value={selectedProg.confirmCount} 
                        />
                        <span class="hint">1 = миттєво</span>
                    </div>
                </div>
            </div>

            <div class="inspector-actions">
                <button class="btn-confirm" onclick={handleConfirm} type="button">
                    <Check size={18} />
                    Призначити
                </button>
                <button class="btn-clear-inline" onclick={handleClear} type="button">
                    <Trash2 size={16} /> Очистити призначення
                </button>
            </div>
        </div>
      {:else}
        <div class="inspector-placeholder">
            <Monitor size={48} />
            <p>Оберіть програму або команду для налаштування</p>
        </div>
      {/if}
    </div>
{/snippet}

<svelte:window onkeydown={onKeydown} />

{#if context}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onmousedown={handleClose} transition:fade={{ duration: 200 }}>
    
    <div 
        class="modal-content" 
        class:minimal-layout={uiState.isMinimalMode}
        onmousedown={(e) => e.stopPropagation()} 
        transition:scale={{ duration: 300, start: 0.95 }}
        data-testid="program-picker-modal"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
      
      <!-- HEADER -->
      <div class="modal-header">
        <div class="header-title">
          <Monitor size={uiState.isMinimalMode ? 16 : 20} />
          <h2>{t.modals.programPickerTitle}: {context.key}</h2>
        </div>
        <button class="btn-close" onclick={handleClose} type="button" aria-label="Close"><X size={20} /></button>
      </div>

      <div class="main-layout">
        <div class="left-column">
            <div class="sidebar">
                {#each tabs as tab}
                    <button 
                        class="side-tab" 
                        class:active={activeTab === tab.id}
                        onclick={() => { activeTab = tab.id; if (tab.id !== 'url' && tab.id !== 'commands') isLoading = true; }}
                        type="button"
                    >
                        <tab.icon size={20} />
                        <span>{tab.label}</span>
                    </button>
                {/each}
            </div>
            <div class="side-inspector">
                {@render inspector()}
            </div>
        </div>

        <div class="content-area">
          <div class="search-box">
            <SearchInput bind:value={searchQuery} placeholder={t.modals.searchPrograms} />
            <div class="view-toggle">
                <button class="view-btn" class:active={viewMode === 'grid'} onclick={() => viewMode = 'grid'} type="button" aria-label="Grid view"><LayoutGrid size={18} /></button>
                <button class="view-btn" class:active={viewMode === 'list'} onclick={() => viewMode = 'list'} type="button" aria-label="List view"><List size={18} /></button>
            </div>
          </div>

          <div class="modal-body">
            {#if activeTab === 'url'}
              <div class="custom-input-section">
                <h3>Add Custom URL</h3>
                <div class="input-group">
                    <input type="text" bind:value={customUrl} placeholder="example.com" onkeydown={(e) => { if (e.key === 'Enter') handleAddUrl(); }} aria-label="URL" />
                    <button class="btn-add" onclick={handleAddUrl} disabled={!customUrl} type="button">Add</button>
                </div>
              </div>
            {:else if activeTab === 'commands'}
              <div class="commands-section">
                <div class="custom-command-box">
                    <div class="info-tag"><Info size={14} /> Підтримує шляхи до папок та системні команди</div>
                    <h4>Custom Command / Path</h4>
                    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 12px;">
                        <div class="input-group">
                            <input type="text" bind:value={customCommand} placeholder="C:\Users\Documents" onkeydown={(e) => { if (e.key === 'Enter') handleAddCustomCommand(); }} aria-label="Command" />
                            <button class="btn-add" onclick={handleAddCustomCommand} disabled={!customCommand} type="button">Add</button>
                        </div>
                    </div>
                </div>

                {@render section("Системні папки", SYSTEM_FOLDERS)}
                {@render section("Системні команди", SYSTEM_COMMANDS)}
              </div>
            {:else if isLoading}
              {@render skeleton()}
            {:else}
              {#if activeTab === 'local' && context?.tab?.path}
                <div class="tab-action-bar">
                    <button class="btn-action-outline" onclick={openLocalFolder} type="button">
                        <FolderOpen size={18} />
                        <span>Відкрити локальну папку</span>
                    </button>
                    <div class="path-display" title={context.tab.path}>{context.tab.path}</div>
                </div>
              {/if}

              {#if filteredPrograms.length === 0}
                <div class="empty">{t.modals.noPrograms}</div>
              {:else}
                <div class="program-container" class:grid-mode={viewMode === 'grid'} class:list-mode={viewMode === 'list'}>
                  {#each filteredPrograms as prog}
                    <button 
                      class="program-item" 
                      class:selected={selectedProg?.path === prog.path}
                      onclick={() => prepareSelection(prog)}
                      title={prog.path}
                      type="button"
                    >
                      <div class="prog-icon">
                        {#if icons[prog.path]}<img src={icons[prog.path]} alt="" />{:else}<div class="icon-placeholder"></div>{/if}
                      </div>
                      <div class="prog-info">
                        <span class="prog-name">{prog.name}</span>
                        {#if viewMode === 'list'}<span class="prog-path">{prog.path}</span>{/if}
                      </div>
                      {#if selectedProg?.path === prog.path}
                          <div class="selection-check" in:scale><Check size={14} /></div>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-bg-primary) 70%, transparent);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 24px;
    width: 95%;
    max-width: 1200px;
    height: 90vh;
    box-shadow: var(--shadow-2xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .main-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .left-column {
    display: flex;
    flex-direction: column;
    width: 320px;
    background: var(--color-surface-1);
    border-right: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .left-column .sidebar {
    width: 100%;
    border-right: none;
    flex-shrink: 0;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .left-column .side-inspector {
    flex: 1;
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--color-border);
    overflow-y: auto;
    padding: 24px;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .modal-header {
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface-1);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title h2 { margin: 0; font-size: 1.1rem; font-weight: 700; }

  .side-tab {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    font-weight: 600;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .side-tab:hover { background: var(--color-surface-2); }
  .side-tab.active { background: var(--color-accent-violet); color: white; }

  /* INSPECTOR */
  .inspector-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
  }

  .inspector-header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .icon-edit-btn {
    position: relative;
    border-radius: 16px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
    color: var(--color-text-primary);
  }
  .icon-edit-btn:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-cyan);
    transform: translateY(-2px);
  }
  
  .icon-edit-btn.size-sm { width: 40px; height: 40px; border-radius: 10px; }
  .icon-edit-btn.size-md { width: 56px; height: 56px; }
  .icon-edit-btn.size-lg { width: 64px; height: 64px; }

  .edit-overlay {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: var(--color-accent-cyan);
    color: black;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .size-sm .edit-overlay { width: 16px; height: 16px; bottom: -2px; right: -2px; }

  .draft-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .input-field label { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 4px; display: block; }
  .input-field input {
    width: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 12px;
    color: var(--color-text-primary);
    font-size: 1rem;
    font-weight: 600;
  }

  .number-input-row {
      display: flex;
      align-items: center;
      gap: 12px;
  }
  .number-input-row input {
      width: 70px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-text-primary);
      font-weight: 700;
  }
  .hint { font-size: 0.75rem; color: var(--color-text-muted); }

  .draft-path { font-size: 0.7rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .label-text { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 4px; display: block; }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 8px;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .mode-btn.active {
    background: color-mix(in srgb, var(--color-accent-cyan) 15%, transparent);
    border-color: var(--color-accent-cyan);
    color: var(--color-accent-cyan);
  }

  .inspector-actions { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
  .btn-confirm {
    width: 100%;
    padding: 14px;
    background: var(--color-accent-cyan);
    color: black;
    border: none;
    border-radius: 14px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
  }

  .btn-clear-inline {
    width: 100%;
    padding: 10px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-danger);
    font-size: 0.8rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-clear-inline:hover {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    border-color: var(--color-danger);
  }

  .inspector-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    gap: 16px;
    color: var(--color-text-muted);
    opacity: 0.5;
    padding: 40px 20px;
  }
  .inspector-placeholder p {
    font-size: 0.9rem;
    line-height: 1.4;
    margin: 0;
  }

  .modal-body { flex: 1; overflow-y: auto; padding: 20px; }

  .program-container.grid-mode {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  .program-container.list-mode { display: flex; flex-direction: column; gap: 8px; }

  .program-item {
    position: relative;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
  .program-item:hover { transform: translateY(-2px); background: var(--color-surface-2); border-color: var(--color-text-muted); }
  .program-item.selected { border-color: var(--color-accent-cyan); background: color-mix(in srgb, var(--color-accent-cyan) 5%, transparent); }

  .grid-mode .program-item { display: flex; flex-direction: column; align-items: center; padding: 20px 12px; gap: 12px; text-align: center; }
  .list-mode .program-item { display: flex; align-items: center; padding: 12px 16px; gap: 16px; }

  .prog-icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, black 10%, transparent); border-radius: 14px; flex-shrink: 0; }
  .prog-icon img { width: 70%; height: 70%; object-fit: contain; }

  .prog-name { font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
  .selection-check { position: absolute; top: 8px; right: 8px; background: var(--color-accent-cyan); color: black; border-radius: 50%; padding: 2px; }

  .btn-add { background: var(--color-accent-violet); color: white; border: none; border-radius: 12px; padding: 0 20px; font-weight: 700; cursor: pointer; height: 40px; }

  .search-box {
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    gap: 12px;
    background: var(--color-surface-1);
  }

  .view-toggle { display: flex; gap: 4px; background: var(--color-surface-2); padding: 4px; border-radius: 10px; }
  .view-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: var(--color-text-muted); border-radius: 6px; cursor: pointer; }
  .view-btn.active { background: var(--color-bg-primary); color: var(--color-accent-cyan); box-shadow: var(--shadow-sm); }

  .tab-action-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .btn-action-outline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--color-accent-cyan);
    color: var(--color-accent-cyan);
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .btn-action-outline:hover {
    background: color-mix(in srgb, var(--color-accent-cyan) 10%, transparent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent-cyan) 20%, transparent);
  }

  .path-display {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .commands-section { display: flex; flex-direction: column; gap: 24px; }
  .section-block { display: flex; flex-direction: column; gap: 12px; }
  .section-block h4 { margin: 0 0 4px 0; font-size: 0.85rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .custom-command-box { background: var(--color-surface-2); padding: 20px; border-radius: 16px; border: 1px solid var(--color-border); }
  .info-tag { font-size: 0.75rem; color: var(--color-accent-cyan); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
  .custom-command-box h4 { margin: 0 0 12px 0; font-size: 0.9rem; }
  .input-group { display: flex; gap: 8px; flex: 1; }
  .input-group input { flex: 1; background: var(--color-bg-primary); border: 1px solid var(--color-border); border-radius: 10px; padding: 0 12px; color: var(--color-text-primary); }

  .btn-close { background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
  .btn-close:hover { background: var(--color-surface-3); color: var(--color-text-primary); }

  .custom-input-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 40px;
    background: var(--color-surface-1);
    border-radius: 20px;
    margin-bottom: 20px;
  }
  .custom-input-section h3 { margin: 0; font-size: 1.2rem; }

  .skeleton-bg { background: linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-surface-3) 50%, var(--color-surface-2) 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite linear; }
  @keyframes skeleton-loading { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
</style>