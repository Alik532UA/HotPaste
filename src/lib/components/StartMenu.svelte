<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Rocket, Trash2, X } from 'lucide-svelte';
  import { startMenuState } from '../states/startMenu.svelte';

  interface KeyInfo {
    label: string;
    code: string;
    wide?: boolean;
    space?: boolean;
  }

  // Keyboard layout data (Physical key codes for mapping)
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

  onMount(() => {
    startMenuState.refreshShortcuts();
  });

  async function handleKeyClick(key: KeyInfo) {
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
    selectedKey = key;
    showMenu = true;
  }

  function handleAssign(shortcut: string) {
    if (selectedKey) {
      startMenuState.assignKey(selectedKey.code, shortcut);
      showMenu = false;
    }
  }

  async function handleLaunch(keyCode: string) {
    await startMenuState.launchKey(keyCode);
  }
</script>

<div class="start-menu-container" in:fade={{ duration: 300 }}>
  <div class="keyboard-body" in:fly={{ y: 20, delay: 100 }}>
    <div class="keyboard-container">
      {#each keyboardRows as row}
        <div class="keyboard-row">
          {#each row as key}
            {@const assignment = startMenuState.assignments[key.code]}
            <button 
              class="key" 
              class:hovered={hoveredKey?.code === key.code}
              class:assigned={!!assignment}
              class:selected={selectedKey?.code === key.code}
              class:wide={key.wide}
              class:space={key.space}
              onmouseenter={() => hoveredKey = key}
              onmouseleave={() => hoveredKey = null}
              onclick={() => handleKeyClick(key)}
              oncontextmenu={(e) => handleKeyContextMenu(e, key)}
              type="button"
            >
              <span class="key-label">{key.label}</span>
              {#if assignment}
                <div class="key-indicator" title={assignment}></div>
                <span class="assignment-hint">{assignment.split('.')[0]}</span>
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
      onclick={() => showMenu = false} 
      onkeydown={(e) => e.key === 'Escape' && (showMenu = false)}
      role="presentation"
    >
      <div 
        class="assignment-modal" 
        transition:fly={{ y: 20 }} 
        onclick={(e) => e.stopPropagation()} 
        onkeydown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div class="modal-header">
          <div class="header-info">
            <span class="key-badge">{selectedKey?.label}</span>
            <h4>Assign Shortcut</h4>
          </div>
          <button class="close-btn" onclick={() => showMenu = false} aria-label="Close"><X size={20} /></button>
        </div>

        <div class="shortcuts-list">
          <button class="shortcut-item none" onclick={() => handleAssign('none')}>
            <div class="item-icon"><Trash2 size={18} /></div>
            <div class="item-details">
              <span class="item-name">Unassign / Clear</span>
              <span class="item-path">Remove program from this key</span>
            </div>
          </button>

          {#if startMenuState.availableShortcuts.length === 0}
            <div class="empty-state">
              <p>No .lnk files found in <code>Documents\HotPaste\start</code></p>
              <button class="refresh-btn" onclick={() => startMenuState.refreshShortcuts()}>Refresh folder</button>
            </div>
          {:else}
            {#each startMenuState.availableShortcuts as shortcut}
              <button 
                class="shortcut-item" 
                class:active={startMenuState.assignments[selectedKey?.code || ''] === shortcut}
                onclick={() => handleAssign(shortcut)}
              >
                <div class="item-icon"><Rocket size={18} /></div>
                <div class="item-details">
                  <span class="item-name">{shortcut.split('.')[0]}</span>
                  <span class="item-path">{shortcut}</span>
                </div>
                {#if startMenuState.assignments[selectedKey?.code || ''] === shortcut}
                  <div class="active-dot"></div>
                {/if}
              </button>
            {/each}
          {/if}
        </div>

        <div class="modal-footer">
          <p>Add <code>.lnk</code> or <code>.exe</code> files to the <code>start</code> folder to see them here.</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .start-menu-container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    position: relative;
  }

  .keyboard-body {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    padding: var(--space-8);
    border-radius: 40px;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.4);
    width: 100%;
    max-width: 1100px;
  }

  .keyboard-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--space-6);
    background: var(--color-bg-primary);
    border-radius: 24px;
    border: 1px solid var(--color-border);
  }

  .keyboard-row {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .key {
    min-width: 52px;
    height: 52px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 0 var(--color-border);
    overflow: hidden;
    padding: 0;
  }

  .key:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-cyan);
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 210, 255, 0.2), 0 0 0 var(--color-border);
  }

  .key:active, .key.selected {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--color-border);
    border-color: var(--color-accent-cyan);
  }

  .key.assigned {
    border-color: rgba(0, 210, 255, 0.5);
    background: rgba(0, 210, 255, 0.05);
  }

  .key.wide {
    min-width: 85px;
    flex-grow: 1;
  }

  .key.space {
    min-width: 320px;
    flex-grow: 4;
  }

  .key-label {
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    z-index: 2;
  }

  .assignment-hint {
    position: absolute;
    bottom: 4px;
    left: 4px;
    right: 4px;
    font-size: 0.6rem;
    color: var(--color-accent-cyan);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
    text-align: center;
  }

  .key-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: var(--color-accent-cyan);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--color-accent-cyan);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
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
    z-index: 1000;
    border-radius: 24px;
  }

  .assignment-modal {
    width: 100%;
    max-width: 450px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 32px;
    padding: var(--space-6);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
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
    font-size: 1rem;
  }

  .modal-header h4 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--color-text-primary);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    position: relative;
  }

  .shortcut-item:hover {
    border-color: var(--color-accent-cyan);
    background: var(--color-surface-3);
    transform: translateX(4px);
  }

  .shortcut-item.active {
    border-color: var(--color-accent-cyan);
    background: rgba(0, 210, 255, 0.1);
  }

  .shortcut-item.none {
    border-style: dashed;
    margin-bottom: 8px;
  }

  .item-icon {
    width: 40px;
    height: 40px;
    background: var(--color-bg-primary);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-accent-cyan);
  }

  .shortcut-item.none .item-icon {
    color: var(--color-error);
  }

  .item-details {
    display: flex;
    flex-direction: column;
  }

  .item-name {
    font-weight: 700;
    font-size: 1rem;
    color: var(--color-text-primary);
  }

  .item-path {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .active-dot {
    position: absolute;
    right: 16px;
    width: 10px;
    height: 10px;
    background: var(--color-accent-cyan);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--color-accent-cyan);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-10) var(--space-4);
    color: var(--color-text-muted);
  }

  .refresh-btn {
    margin-top: 12px;
    background: var(--color-surface-3);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: 8px 20px;
    border-radius: 20px;
    cursor: pointer;
  }

  .modal-footer {
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    text-align: center;
  }

  .modal-footer p {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  code {
    background: var(--color-surface-3);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    color: var(--color-accent-cyan);
  }
</style>
