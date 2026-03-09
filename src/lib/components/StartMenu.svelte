<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Rocket, Trash2, X, Activity, LayoutGrid, Folder } from 'lucide-svelte';
  import { startMenuState, type ShortcutInfo } from '../states/startMenu.svelte';
  import { uiState } from '../stores/uiState.svelte';

  interface KeyInfo {
    label: string;
    code: string;
    wide?: boolean;
    space?: boolean;
  }

  const keyboardRows: KeyInfo[][] = [
    [
      { label: 'Esc', code: 'Escape' },
      { label: 'F1', code: 'F1' }, { label: 'F2', code: 'F2' }, { label: 'F3', code: 'F3' }, { label: 'F4', code: 'F4' },
      { label: 'F5', code: 'F5' }, { label: 'F6', code: 'F6' }, { label: 'F7', code: 'F7' }, { label: 'F8', code: 'F8' },
      { label: 'F9', code: 'F9' }, { label: 'F10', code: 'F10' }, { label: 'F11', code: 'F11' }, { label: 'F12', code: 'F12' }
    ],
    [
      { label: '`', code: 'Backquote' },
      { label: '1', code: 'Digit1' }, { label: '2', code: 'Digit2' }, { label: '3', code: 'Digit3' }, { label: '4', code: 'Digit4' },
      { label: '5', code: 'Digit5' }, { label: '6', code: 'Digit6' }, { label: '7', code: 'Digit7' }, { label: '8', code: 'Digit8' },
      { label: '9', code: 'Digit9' }, { label: '0', code: 'Digit0' }, { label: '-', code: 'Minus' }, { label: '=', code: 'Equal' },
      { label: 'Backspace', code: 'Backspace', wide: true }
    ],
    [
      { label: 'Tab', code: 'Tab', wide: true },
      { label: 'Q', code: 'KeyQ' }, { label: 'W', code: 'KeyW' }, { label: 'E', code: 'KeyE' }, { label: 'R', code: 'KeyR' },
      { label: 'T', code: 'KeyT' }, { label: 'Y', code: 'KeyY' }, { label: 'U', code: 'KeyU' }, { label: 'I', code: 'KeyI' },
      { label: 'O', code: 'KeyO' }, { label: 'P', code: 'KeyP' }, { label: '[', code: 'BracketLeft' }, { label: ']', code: 'BracketRight' },
      { label: '\\', code: 'Backslash' }
    ],
    [
      { label: 'Caps', code: 'CapsLock', wide: true },
      { label: 'A', code: 'KeyA' }, { label: 'S', code: 'KeyS' }, { label: 'D', code: 'KeyD' }, { label: 'F', code: 'KeyF' },
      { label: 'G', code: 'KeyG' }, { label: 'H', code: 'KeyH' }, { label: 'J', code: 'KeyJ' }, { label: 'K', code: 'KeyK' },
      { label: 'L', code: 'KeyL' }, { label: ';', code: 'Semicolon' }, { label: "'", code: 'Quote' },
      { label: 'Enter', code: 'Enter', wide: true }
    ],
    [
      { label: 'Shift', code: 'ShiftLeft', wide: true },
      { label: 'Z', code: 'KeyZ' }, { label: 'X', code: 'KeyX' }, { label: 'C', code: 'KeyC' }, { label: 'V', code: 'KeyV' },
      { label: 'B', code: 'KeyB' }, { label: 'N', code: 'KeyN' }, { label: 'M', code: 'KeyM' }, { label: ',', code: 'Comma' },
      { label: '.', code: 'Period' }, { label: '/', code: 'Slash' },
      { label: 'Shift', code: 'ShiftRight', wide: true }
    ],
    [
      { label: 'Ctrl', code: 'ControlLeft' }, { label: 'Win', code: 'MetaLeft' }, { label: 'Alt', code: 'AltLeft' },
      { label: 'Space', code: 'Space', space: true },
      { label: 'Alt', code: 'AltRight' }, { label: 'Win', code: 'MetaRight' }, { label: 'Menu', code: 'ContextMenu' }, { label: 'Ctrl', code: 'ControlRight' }
    ]
  ];

  let hoveredKey = $state<KeyInfo | null>(null);
  let selectedKey = $state<KeyInfo | null>(null);
  let showMenu = $state(false);
  let activeCategory = $state<'local' | 'running' | 'system'>('local');

  // Load icons for the active category whenever it changes
  $effect(() => {
    if (showMenu) {
      startMenuState.loadIconsForCategory(activeCategory);
    }
  });

  onMount(() => {
    startMenuState.refreshShortcuts();
    
    // Global keyboard listener for physical key presses
    const handleKeyDown = (e: KeyboardEvent) => {
      // If assignment modal is open, we don't want to launch programs
      if (showMenu) return;
      
      // Prevent browser defaults for intercepted keys (like Tab, F-keys, etc.)
      // but only if they have an assignment to avoid breaking normal UI usage
      const assignment = startMenuState.assignments[e.code];
      if (assignment && isKeyClickable(e.code)) {
        e.preventDefault();
        handleLaunch(e.code);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  async function handleKeyClick(key: KeyInfo) {
    import('../services/logService.svelte').then(m => m.logService.debug('startMenu', `Key clicked: ${key.code}, showMenu: ${showMenu}`));
    const assignment = startMenuState.assignments[key.code];
    if (assignment) {
      await handleLaunch(key.code);
    } else {
      selectedKey = key;
      showMenu = true;
    }
  }

  function handleKeyContextMenu(e: MouseEvent, key: KeyInfo) {
    e.preventDefault();
    import('../services/logService.svelte').then(m => m.logService.debug('startMenu', `Key context menu: ${key.code}`));
    selectedKey = key;
    showMenu = true;
  }

  function handleAssign(shortcut: ShortcutInfo | 'none') {
    import('../services/logService.svelte').then(m => m.logService.info('startMenu', `Assigning shortcut: ${shortcut === 'none' ? 'NONE' : shortcut.name}`));
    if (selectedKey && isKeyClickable(selectedKey.code)) {
      startMenuState.assignKey(selectedKey.code, shortcut);
      showMenu = false;
    }
  }

  function isKeyClickable(code: string): boolean {
    if (code.startsWith('Key')) return true;
    if (['BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'].includes(code)) return true;
    return false;
  }

  async function handleLaunch(keyCode: string) {
    await start_menu_launch(keyCode);
  }

  async function start_menu_launch(keyCode: string) {
    await startMenuState.launchKey(keyCode);
  }

  async function handleClearCache() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_icon_cache');
      import('../services/logService.svelte').then(m => m.logService.info('startMenu', 'Icon cache cleared'));
      startMenuState.refreshShortcuts(); // Refresh icons after clearing
    } catch (err) {
      import('../services/logService.svelte').then(m => m.logService.error('startMenu', 'Failed to clear cache', err));
    }
  }

  const currentShortcuts = $derived(() => {
    if (activeCategory === 'local') return startMenuState.availableShortcuts;
    if (activeCategory === 'running') return startMenuState.runningProcesses;
    if (activeCategory === 'system') return startMenuState.systemShortcuts;
    return [];
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
            {@const assignment = startMenuState.assignments[key.code]}
            {@const clickable = isKeyClickable(key.code)}
            <button 
              class="key" 
              class:hovered={hoveredKey?.code === key.code}
              class:assigned={!!assignment}
              class:selected={selectedKey?.code === key.code}
              class:disabled={!clickable}
              class:wide={key.wide}
              class:space={key.space}
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
          {/each}
        </div>
      {/each}
    </div>
  </div>

  {#if showMenu}
    <div 
      class="assignment-overlay" 
      transition:fade={{ duration: 200 }} 
      onclick={() => {
        import('../services/logService.svelte').then(m => m.logService.debug('startMenu', 'Overlay clicked - closing modal'));
        showMenu = false;
      }} 
      onkeydown={(e) => e.key === 'Escape' && (showMenu = false)}
      role="presentation"
      data-testid="start-menu-overlay"
    >
      <div 
        class="assignment-modal" 
        transition:fly={{ y: 20 }} 
        onclick={(e) => {
          e.stopPropagation();
          import('../services/logService.svelte').then(m => m.logService.debug('startMenu', 'Modal content clicked - propagation stopped'));
        }} 
        onkeydown={(e) => e.stopPropagation()}
        role="presentation"
        data-testid="start-menu-modal"
      >
        <div class="modal-header">
          <div class="header-info">
            <span class="key-badge" data-testid="selected-key-label">{selectedKey?.label}</span>
            <h4>Assign Shortcut</h4>
          </div>
          <div class="header-actions">
            <button 
              class="action-icon-btn" 
              onclick={handleClearCache} 
              title="Clear Icon Cache"
              data-testid="btn-clear-cache"
            >
              <Trash2 size={18} />
            </button>
            <button 
              class="close-btn" 
              onclick={() => showMenu = false} 
              aria-label="Close"
              data-testid="btn-close-assignment-modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div class="modal-layout">
          <aside class="category-switcher" data-testid="category-switcher">
            <button 
              class="cat-btn" 
              class:active={activeCategory === 'local'} 
              onclick={() => activeCategory = 'local'}
              title="Documents/HotPaste/start"
              data-testid="btn-category-local"
            >
              <Folder size={20} />
              <span>Local</span>
            </button>
            <button 
              class="cat-btn" 
              class:active={activeCategory === 'running'} 
              onclick={() => activeCategory = 'running'}
              title="Running Processes"
              data-testid="btn-category-running"
            >
              <Activity size={20} />
              <span>Running</span>
            </button>
            <button 
              class="cat-btn" 
              class:active={activeCategory === 'system'} 
              onclick={() => activeCategory = 'system'}
              title="System Start Menu"
              data-testid="btn-category-system"
            >
              <LayoutGrid size={20} />
              <span>System</span>
            </button>
          </aside>

          <div class="shortcuts-list" data-testid="shortcuts-grid">
            <button 
              class="shortcut-item none-card" 
              onclick={() => handleAssign('none')}
              data-testid="btn-unassign-key"
            >
              <div class="item-icon large"><Trash2 size={24} /></div>
              <span class="item-name">Clear</span>
            </button>

            {#if currentShortcuts().length === 0}
              <div class="empty-state" data-testid="shortcuts-empty-state">
                <p>No programs found.</p>
                <button 
                  class="refresh-btn" 
                  onclick={() => startMenuState.refreshShortcuts()}
                  data-testid="btn-refresh-shortcuts"
                >
                  Refresh
                </button>
              </div>
            {:else}
              {#each currentShortcuts() as shortcut, i}
                <button 
                  class="shortcut-item card" 
                  class:active={startMenuState.assignments[selectedKey?.code || '']?.path === shortcut.path}
                  onclick={() => handleAssign(shortcut)}
                  title={shortcut.path}
                  data-testid="btn-shortcut-{i}"
                >
                  <div class="item-icon large">
                    {#if shortcut.icon}
                      <img src="data:image/png;base64,{shortcut.icon}" alt={shortcut.name} class="app-icon-img" />
                    {:else}
                      {#if activeCategory === 'local'}<Rocket size={28} />{/if}
                      {#if activeCategory === 'running'}<Activity size={28} />{/if}
                      {#if activeCategory === 'system'}<LayoutGrid size={28} />{/if}
                    {/if}
                  </div>
                  <span class="item-name">{shortcut.name}</span>
                  {#if startMenuState.assignments[selectedKey?.code || '']?.path === shortcut.path}
                    <div class="active-badge" data-testid="active-shortcut-indicator"></div>
                  {/if}
                </button>
              {/each}
            {/if}
          </div>
        </div>

        <div class="modal-footer">
          <p>Select a program to assign it to <strong>{selectedKey?.label}</strong>.</p>
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
    transition: background-color 0.2s ease;
  }

  .start-menu-container.minimal {
    background: rgba(0, 0, 0, 0) !important;
    background-color: rgba(0, 0, 0, 0) !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .start-menu-container.minimal .keyboard-body {
    /* Fill the window completely since we handle rounding on the native level */
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    aspect-ratio: 2.5 !important;
    
    border-radius: var(--radius-window) !important;
    border: none !important;
    margin: 0 !important;
    padding: 1.5% !important;
    box-shadow: none !important; 
  }

  .keyboard-body {
    background: rgba(15, 15, 22, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1.5%;
    border-radius: 2vw;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8);
    position: relative;
    z-index: 1;
    transition: filter 0.3s ease, transform 0.3s ease;
    
    /* 
       The keyboard will be 95% width, BUT 
       it will shrink if the height (available vh * 2.5 ratio) is smaller.
       112px is Header (64px) + TabBar (48px). We use 140px for safety margins.
    */
    width: min(95%, calc((100vh - 140px) * 2.5));
    aspect-ratio: 2.5;
    
    display: flex;
    flex-direction: column;
    margin: auto;
    container-type: inline-size;
  }

  .keyboard-body.modal-open {
    pointer-events: none;
    visibility: hidden; /* This completely removes interactivity while modal is open */
    opacity: 0;
    transition: opacity 0.2s, visibility 0.2s;
  }

  .keyboard-container {
    display: flex;
    flex-direction: column;
    gap: 2%;
    padding: 1.5%;
    background: var(--color-bg-primary);
    border-radius: 1.5cqw;
    border: 1px solid var(--color-border);
    flex: 1;
    min-height: 0;
  }

  .keyboard-row {
    display: flex;
    justify-content: center;
    gap: 1%;
    flex: 1;
    min-height: 0;
  }

  .key {
    flex: 1;
    min-width: 0;
    height: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 0.8cqw;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 0.3cqw 0 var(--color-border);
    overflow: hidden;
    padding: 0;
  }

  .key.wide {
    flex: 1.7;
  }

  .key.space {
    flex: 6.5;
  }

  .key:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-cyan);
    box-shadow: 0 0.3cqw 0 var(--color-accent-cyan);
  }

  .key:active, .key.selected {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--color-accent-cyan);
    border-color: var(--color-accent-cyan);
  }

  .key.assigned {
    border-color: var(--color-accent-cyan);
    background: rgba(0, 210, 255, 0.03);
    box-shadow: 0 0.3cqw 0 rgba(0, 210, 255, 0.3);
  }

  .key-label {
    position: absolute;
    top: 8%;
    left: 8%;
    font-size: 1cqw;
    font-weight: 800;
    color: var(--color-text-muted);
    text-transform: uppercase;
    z-index: 2;
    line-height: 1;
  }

  .key:hover .key-label {
    color: var(--color-text-secondary);
  }

  .key-app-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding-top: 10%;
  }

  .key-app-icon {
    width: 45%;
    height: 45%;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    image-rendering: -webkit-optimize-contrast;
  }

  :global(.key-app-icon-fallback) {
    width: 35%;
    height: 35%;
    color: var(--color-accent-cyan);
    opacity: 0.4;
  }

  /* Assignment Menu */
  .assignment-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000; /* Increased */
    border-radius: inherit;
    pointer-events: auto !important;
  }

  .assignment-modal {
    width: 95%;
    height: 95%;
    max-width: 1800px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 32px;
    padding: var(--space-8);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    pointer-events: auto !important;
    z-index: 10001;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
    flex-shrink: 0;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .key-badge {
    background: var(--color-accent-cyan);
    color: black;
    padding: 4px 12px;
    border-radius: 8px;
    font-weight: 900;
    font-size: 1.25rem;
  }

  .modal-header h4 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .action-icon-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 10px;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-icon-btn:hover {
    background: rgba(255, 60, 60, 0.1);
    color: var(--color-error);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 12px;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .modal-layout {
    display: flex;
    gap: var(--space-8);
    flex: 1;
    min-height: 0;
  }

  .category-switcher {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 120px;
    border-right: 1px solid var(--color-border);
    padding-right: var(--space-6);
    flex-shrink: 0;
  }

  .cat-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: var(--space-4) var(--space-2);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-text-muted);
  }

  .cat-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .cat-btn.active {
    background: rgba(0, 210, 255, 0.1);
    border-color: var(--color-accent-cyan);
    color: var(--color-accent-cyan);
  }

  .cat-btn span {
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shortcuts-list {
    flex-grow: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    grid-auto-rows: min-content;
    gap: 16px;
    overflow-y: auto;
    padding-right: 12px;
    padding-bottom: 12px;
  }

  .shortcut-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: var(--space-6);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 24px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    aspect-ratio: 1;
    position: relative;
    text-align: center;
  }

  .shortcut-item:hover {
    border-color: var(--color-accent-cyan);
    background: var(--color-surface-3);
    transform: translateY(-6px);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
  }

  .shortcut-item.active {
    border-color: var(--color-accent-cyan);
    background: rgba(0, 210, 255, 0.1);
    box-shadow: 0 0 20px rgba(0, 210, 255, 0.2);
  }

  .shortcut-item.none-card {
    border-style: dashed;
    border-width: 2px;
    color: var(--color-error);
    opacity: 0.8;
  }

  .shortcut-item.none-card:hover {
    border-color: var(--color-error);
    background: rgba(255, 60, 60, 0.05);
    opacity: 1;
  }

  .item-icon.large {
    width: 64px;
    height: 64px;
    background: var(--color-bg-primary);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-accent-cyan);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s;
    overflow: hidden;
    flex-shrink: 0;
  }

  .app-icon-img {
    max-width: 40px;
    max-height: 40px;
    width: auto;
    height: auto;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
  }

  .shortcut-item:hover .item-icon.large {
    transform: scale(1.1);
  }

  .shortcut-item.none-card .item-icon.large {
    color: var(--color-error);
    background: transparent;
    box-shadow: none;
    border: 1px dashed var(--color-error);
  }

  .item-name {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--color-text-primary);
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.2;
  }

  .active-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 14px;
    height: 14px;
    background: var(--color-accent-cyan);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--color-accent-cyan);
    border: 2px solid var(--color-surface-1);
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: var(--space-16) var(--space-4);
    color: var(--color-text-muted);
  }

  .refresh-btn {
    margin-top: 16px;
    background: var(--color-surface-3);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 10px 32px;
    border-radius: 24px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.2s;
  }

  .refresh-btn:hover {
    background: var(--color-accent-cyan);
    color: black;
  }

  .modal-footer {
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    text-align: center;
    flex-shrink: 0;
  }

  .modal-footer p {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0;
  }
</style>
