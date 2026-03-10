<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Rocket, Trash2, X, Activity, LayoutGrid, Folder, Search } from 'lucide-svelte';
  import { startMenuState, type ShortcutInfo } from '../states/startMenu.svelte';
  import { uiState } from '../stores/uiState.svelte';

  interface KeyInfo {
    label: string;
    code: string;
    width?: number; // Relative width (1 = standard key)
    isSpacer?: boolean;
  }

  const keyboardRows: KeyInfo[][] = [
    [
      { label: 'Esc', code: 'Escape', width: 1 },
      { label: '', code: '', width: 0.5, isSpacer: true },
      { label: 'F1', code: 'F1' }, { label: 'F2', code: 'F2' }, { label: 'F3', code: 'F3' }, { label: 'F4', code: 'F4' },
      { label: '', code: '', width: 0.5, isSpacer: true },
      { label: 'F5', code: 'F5' }, { label: 'F6', code: 'F6' }, { label: 'F7', code: 'F7' }, { label: 'F8', code: 'F8' },
      { label: '', code: '', width: 0.5, isSpacer: true },
      { label: 'F9', code: 'F9' }, { label: 'F10', code: 'F10' }, { label: 'F11', code: 'F11' }, { label: 'F12', code: 'F12' }
    ],
    [
      { label: '`', code: 'Backquote' },
      { label: '1', code: 'Digit1' }, { label: '2', code: 'Digit2' }, { label: '3', code: 'Digit3' }, { label: '4', code: 'Digit4' },
      { label: '5', code: 'Digit5' }, { label: '6', code: 'Digit6' }, { label: '7', code: 'Digit7' }, { label: '8', code: 'Digit8' },
      { label: '9', code: 'Digit9' }, { label: '0', code: 'Digit0' }, { label: '-', code: 'Minus' }, { label: '=', code: 'Equal' },
      { label: 'Backspace', code: 'Backspace', width: 2 }
    ],
    [
      { label: 'Tab', code: 'Tab', width: 1.5 },
      { label: 'Q', code: 'KeyQ' }, { label: 'W', code: 'KeyW' }, { label: 'E', code: 'KeyE' }, { label: 'R', code: 'KeyR' },
      { label: 'T', code: 'KeyT' }, { label: 'Y', code: 'KeyY' }, { label: 'U', code: 'KeyU' }, { label: 'I', code: 'KeyI' },
      { label: 'O', code: 'KeyO' }, { label: 'P', code: 'KeyP' }, { label: '[', code: 'BracketLeft' }, { label: ']', code: 'BracketRight' },
      { label: '\\', code: 'Backslash', width: 1.5 }
    ],
    [
      { label: 'Caps', code: 'CapsLock', width: 1.75 },
      { label: 'A', code: 'KeyA' }, { label: 'S', code: 'KeyS' }, { label: 'D', code: 'KeyD' }, { label: 'F', code: 'KeyF' },
      { label: 'G', code: 'KeyG' }, { label: 'H', code: 'KeyH' }, { label: 'J', code: 'KeyJ' }, { label: 'K', code: 'KeyK' },
      { label: 'L', code: 'KeyL' }, { label: ';', code: 'Semicolon' }, { label: "'", code: 'Quote' },
      { label: 'Enter', code: 'Enter', width: 2.25 }
    ],
    [
      { label: 'Shift', code: 'ShiftLeft', width: 2.25 },
      { label: 'Z', code: 'KeyZ' }, { label: 'X', code: 'KeyX' }, { label: 'C', code: 'KeyC' }, { label: 'V', code: 'KeyV' },
      { label: 'B', code: 'KeyB' }, { label: 'N', code: 'KeyN' }, { label: 'M', code: 'KeyM' }, { label: ',', code: 'Comma' },
      { label: '.', code: 'Period' }, { label: '/', code: 'Slash' },
      { label: 'Shift', code: 'ShiftRight', width: 2.75 }
    ],
    [
      { label: 'Ctrl', code: 'ControlLeft', width: 1.25 }, { label: 'Win', code: 'MetaLeft', width: 1.25 }, { label: 'Alt', code: 'AltLeft', width: 1.25 },
      { label: 'Space', code: 'Space', width: 6.25 },
      { label: 'Alt', code: 'AltRight', width: 1.25 }, { label: 'Win', code: 'MetaRight', width: 1.25 }, { label: 'Menu', code: 'ContextMenu', width: 1.25 }, { label: 'Ctrl', code: 'ControlRight', width: 1.25 }
    ]
  ];

  let hoveredKey = $state<KeyInfo | null>(null);
  let selectedKey = $state<KeyInfo | null>(null);
  let showMenu = $state(false);
  let activeCategory = $state<'local' | 'running' | 'system'>('local');
  let searchQuery = $state('');

  let searchInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (showMenu) {
      startMenuState.loadIconsForCategory(activeCategory);
      // Auto-focus search input when modal opens
      setTimeout(() => searchInput?.focus(), 50);
    }
  });

  // Reset search when category changes
  $effect(() => {
    activeCategory;
    searchQuery = '';
    // Re-focus after category change
    setTimeout(() => searchInput?.focus(), 50);
  });

  onMount(() => {
    startMenuState.refreshShortcuts();
    
    const handleKeyDown = async (e: KeyboardEvent) => {
      // 1. Don't intercept if modal is open (modal has its own local logic)
      if (showMenu) return;

      // 2. Don't intercept if user is typing in ANY input field (e.g., global search)
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        ['INPUT', 'TEXTAREA'].includes(activeEl.tagName.toUpperCase()) ||
        (activeEl as HTMLElement).isContentEditable
      );
      if (isInput) return;

      // 3. Handle assignments
      const assignment = startMenuState.assignments[e.code];
      if (assignment && isKeyClickable(e.code)) {
        e.preventDefault();
        await handleLaunch(e.code);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  async function handleKeyClick(key: KeyInfo) {
    import('../services/logService.svelte').then(m => m.logService.debug('startMenu', `Key clicked: ${key.code}, showMenu: ${showMenu}`));
    
    // Special keys that should hide the window instantly
    if (['Escape', 'Enter', 'Space'].includes(key.code)) {
      await handleHide();
      return;
    }

    const assignment = startMenuState.assignments[key.code];
    if (assignment) {
      await handleLaunch(key.code);
    } else {
      selectedKey = key;
      searchQuery = '';
      showMenu = true;
    }
  }

  function handleKeyContextMenu(e: MouseEvent, key: KeyInfo) {
    e.preventDefault();
    // Only allow context menu for actual assignable keys
    if (!isKeyAssignable(key.code)) return;
    
    import('../services/logService.svelte').then(m => m.logService.debug('startMenu', `Key context menu: ${key.code}`));
    selectedKey = key;
    searchQuery = '';
    showMenu = true;
  }

  function closeModal() {
    showMenu = false;
    selectedKey = null;
    searchQuery = '';
  }

  function handleAssign(shortcut: ShortcutInfo | 'none') {
    import('../services/logService.svelte').then(m => m.logService.info('startMenu', `Assigning shortcut: ${shortcut === 'none' ? 'NONE' : shortcut.name}`));
    if (selectedKey && isKeyAssignable(selectedKey.code)) {
      startMenuState.assignKey(selectedKey.code, shortcut);
      closeModal();
    }
  }

  function isKeyAssignable(code: string): boolean {
    if (code.startsWith('Key')) return true;
    if (code.startsWith('F') && /^F[1-9][0-2]?$/.test(code)) {
      const num = parseInt(code.substring(1));
      return num >= 1 && num <= 12;
    }
    if (['BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'].includes(code)) return true;
    return false;
  }

  function isKeyClickable(code: string): boolean {
    return isKeyAssignable(code);
  }

  async function handleHide() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('hide_window');
    } catch (err) {
      console.error('Failed to hide window via command:', err);
      // Fallback to JS API
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        getCurrentWindow().hide();
      } catch (innerErr) {
        console.error('Failed to hide window via JS API:', innerErr);
      }
    }
  }

  async function handleLaunch(keyCode: string) {
    // Start launching in background
    startMenuState.launchKey(keyCode);
    
    // Hide window INSTANTLY for better UX
    await handleHide();
  }

  async function handleClearCache() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_icon_cache');
      import('../services/logService.svelte').then(m => m.logService.info('startMenu', 'Icon cache cleared'));
      startMenuState.refreshShortcuts();
    } catch (err) {
      import('../services/logService.svelte').then(m => m.logService.error('startMenu', 'Failed to clear cache', err));
    }
  }

  const currentShortcuts = $derived(() => {
    let base: ShortcutInfo[] = [];
    if (activeCategory === 'local') base = startMenuState.availableShortcuts;
    else if (activeCategory === 'running') base = startMenuState.runningProcesses;
    else if (activeCategory === 'system') base = startMenuState.systemShortcuts;

    if (!searchQuery.trim()) return base;
    const query = searchQuery.toLowerCase();
    return base.filter(s => s.name.toLowerCase().includes(query));
  });
</script>

<div class="start-menu-container" class:minimal={uiState.isMinimalMode} in:fade={{ duration: 300 }}>
  <div 
    class="keyboard-body" 
    class:modal-open={showMenu}
    in:fly={{ y: 20, delay: 100 }} 
    data-tauri-drag-region={!showMenu ? "" : undefined}
  >
    <div class="keyboard-container">
      {#each keyboardRows as row}
        <div class="keyboard-row">
          {#each row as key}
            {#if key.isSpacer}
              <div class="key-spacer" style="flex: {key.width || 1}"></div>
            {:else}
              {@const assignment = startMenuState.assignments[key.code]}
              {@const clickable = isKeyClickable(key.code)}
              <button 
                class="key" 
                class:hovered={hoveredKey?.code === key.code}
                class:assigned={!!assignment}
                class:selected={selectedKey?.code === key.code}
                class:disabled={!clickable}
                style="flex: {key.width || 1}"
                onmouseenter={() => hoveredKey = key}
                onmouseleave={() => hoveredKey = null}
                onclick={() => clickable && handleKeyClick(key)}
                oncontextmenu={(e) => clickable && handleKeyContextMenu(e, key)}
                type="button"
                disabled={!clickable && !assignment}
                data-testid="key-{key.code}"
              >
                <span class="key-label">{key.label}</span>
                {#if assignment}
                  <div class="key-app-icon-container">
                    {#if assignment.icon}
                      <img src="data:image/png;base64,{assignment.icon}" alt="" class="key-app-icon" />
                    {:else}
                      <Rocket size={16} class="key-app-icon-fallback" />
                    {/if}
                  </div>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>

  {#if showMenu}
    <div 
      class="assignment-overlay" 
      transition:fade={{ duration: 200 }} 
      onclick={closeModal} 
      role="presentation"
    >
      <div class="assignment-modal" transition:fly={{ y: 20 }} onclick={(e) => e.stopPropagation()} role="presentation">
        <div class="modal-header">
          <div class="header-info">
            <span class="key-badge">{selectedKey?.label}</span>
            <h4>Assign Shortcut</h4>
          </div>
          <div class="header-search">
            <div class="search-input-wrapper">
              <Search size={18} class="search-icon" />
              <input
                bind:this={searchInput}
                type="text"
                bind:value={searchQuery}
                placeholder="Search shortcuts..."
                spellcheck="false"
                autocomplete="off"
                onkeydown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    if (searchQuery) {
                      searchQuery = '';
                    } else {
                      closeModal();
                    }
                  }
                }}
              />              {#if searchQuery}
                <button class="clear-search" onclick={() => searchQuery = ''}><X size={14} /></button>
              {/if}
            </div>
          </div>
          <div class="header-actions">
            <button class="action-icon-btn" onclick={handleClearCache} title="Clear Icon Cache"><Trash2 size={18} /></button>
            <button class="close-btn" onclick={closeModal} aria-label="Close"><X size={20} /></button>
          </div>
        </div>

        <div class="modal-layout">
          <aside class="category-switcher">
            <button class="cat-btn" class:active={activeCategory === 'local'} onclick={() => activeCategory = 'local'} title="Local Files">
              <Folder size={20} /> <span>Local</span>
            </button>
            <button class="cat-btn" class:active={activeCategory === 'running'} onclick={() => activeCategory = 'running'} title="Running">
              <Activity size={20} /> <span>Running</span>
            </button>
            <button class="cat-btn" class:active={activeCategory === 'system'} onclick={() => activeCategory = 'system'} title="System">
              <LayoutGrid size={20} /> <span>System</span>
            </button>
          </aside>

          <div class="shortcuts-list">
            {#if !searchQuery}
              <button class="shortcut-item none-card" onclick={() => handleAssign('none')}>
                <div class="item-icon large"><Trash2 size={24} /></div>
                <span class="item-name">Clear</span>
              </button>
            {/if}

            {#each currentShortcuts() as shortcut, i}
              <button 
                class="shortcut-item card" 
                class:active={startMenuState.assignments[selectedKey?.code || '']?.path === shortcut.path}
                onclick={() => handleAssign(shortcut)}
                title={shortcut.path}
              >
                <div class="item-icon large">
                  {#if shortcut.icon}
                    <img src="data:image/png;base64,{shortcut.icon}" alt={shortcut.name} class="app-icon-img" />
                  {:else}
                    <Rocket size={28} />
                  {/if}
                </div>
                <span class="item-name">{shortcut.name}</span>
              </button>
            {:else}
               <div class="no-results">No shortcuts found for "{searchQuery}"</div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .start-menu-container {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2vh;
    position: relative;
    overflow: hidden;
    min-height: 0;
  }

  .start-menu-container.minimal {
    padding: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
  }

  .keyboard-body {
    background: rgba(12, 12, 18, 0.96);
    backdrop-filter: blur(25px);
    border: none !important;
    padding: 1.2%;
    border-radius: var(--radius-window) !important;
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.9);
    width: min(98%, calc((100vh - 140px) * 2.5));
    aspect-ratio: 2.5;
    display: flex;
    flex-direction: column;
    margin: auto;
    container-type: inline-size;
  }

  /* Force keyboard to fill entire window in Minimal Mode */
  .minimal .keyboard-body {
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    aspect-ratio: auto !important;
    border-radius: var(--radius-window) !important;
    padding: 1% !important;
  }

  .keyboard-body.modal-open {
    visibility: hidden;
    opacity: 0;
  }

  .keyboard-container {
    display: flex;
    flex-direction: column;
    gap: 1.5%;
    padding: 1%;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 1cqw;
    flex: 1;
  }

  .keyboard-row {
    display: flex;
    justify-content: center;
    gap: 0.8%;
    flex: 1;
  }

  .key-spacer {
    pointer-events: none;
  }

  .key {
    min-width: 0;
    height: 100%;
    background: rgba(32, 32, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0.6cqw;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    transition: all 0.1s ease;
    box-shadow: 0 0.3cqw 0 rgba(0, 0, 0, 0.4);
    overflow: hidden;
    padding: 0;
  }

  .key:hover {
    background: rgba(60, 60, 80, 0.9);
    border-color: rgba(0, 210, 255, 0.3);
  }

  .key:active, .key.selected {
    transform: translateY(0.2cqw);
    box-shadow: 0 0.1cqw 0 rgba(0, 0, 0, 0.6);
    background: rgba(20, 20, 30, 1);
  }

  .key.assigned {
    /* Assigned keys look like normal keys, only with an icon */
    background: rgba(32, 32, 42, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .key.disabled {
    opacity: 0.5;
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.02);
    cursor: default;
    box-shadow: none;
    pointer-events: none;
  }

  .key-label {
    position: absolute;
    top: 10%;
    left: 10%;
    font-size: 0.8cqw;
    font-weight: 700;
    color: var(--color-text-muted);
    letter-spacing: -0.01em;
  }

  .key.disabled .key-label {
    font-size: 0.65cqw;
    font-weight: 500;
  }

  .key-app-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding-top: 10%;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .key-app-icon {
    width: 46%;
    height: 48%;
    object-fit: contain;
    background: transparent !important;
    border: none !important;
  }

  /* Assignment Modal */
  .assignment-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .assignment-modal {
    width: 92%;
    height: 90%;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 32px;
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    box-shadow: 0 50px 100px rgba(0, 0, 0, 0.8);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    gap: 32px;
  }

  .header-info {
     display: flex;
     align-items: center;
     gap: 16px;
     min-width: fit-content;
  }

  .header-search {
    flex: 1;
    max-width: 600px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 0 16px;
    height: 48px;
    transition: all 0.2s;
  }

  .search-input-wrapper:focus-within {
    border-color: var(--color-accent-cyan);
    background: var(--color-surface-2);
    box-shadow: 0 0 0 4px rgba(0, 210, 255, 0.1);
  }

  :global(.search-icon) {
    color: var(--color-text-muted);
    margin-right: 12px;
  }

  .search-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: 1rem;
    outline: none;
    width: 100%;
  }

  .clear-search {
    background: var(--color-surface-3);
    border: none;
    color: var(--color-text-primary);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-left: 8px;
  }

  .key-badge {
    background: var(--color-accent-cyan);
    color: black;
    padding: 4px 16px;
    border-radius: 12px;
    font-weight: 900;
    font-size: 1.4rem;
  }

  .modal-layout {
    display: flex;
    gap: 32px;
    flex: 1;
    min-height: 0;
  }

  .category-switcher {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100px;
  }

  .cat-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 8px;
    background: transparent;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    color: var(--color-text-muted);
    transition: all 0.2s;
  }

  .cat-btn.active {
    background: rgba(0, 210, 255, 0.1);
    color: var(--color-accent-cyan);
  }

  .shortcuts-list {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    overflow-y: auto;
    padding-bottom: 20px;
    align-content: start;
  }

  .no-results {
    grid-column: 1 / -1;
    text-align: center;
    padding: 48px;
    color: var(--color-text-muted);
    font-size: 1.1rem;
  }

  .shortcut-item {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s;
    height: fit-content;
  }

  .shortcut-item:hover {
    transform: translateY(-4px);
    border-color: var(--color-accent-cyan);
    background: var(--color-surface-2);
  }

  .item-icon.large {
    width: 56px;
    height: 56px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-icon-img {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }

  .item-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--color-text-primary);
    text-align: center;
  }

  .close-btn, .action-icon-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
  }

  .close-btn:hover { background: rgba(255, 255, 255, 0.1); }
</style>
