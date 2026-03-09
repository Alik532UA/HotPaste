<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { Keyboard as KeyboardIcon } from 'lucide-svelte';

  // Keyboard layout data
  const keyboardRows = [
    ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
    ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
    ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
    ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Win', 'Menu', 'Ctrl']
  ];

  let hoveredKey = $state<string | null>(null);

  function handleKeyHover(key: string) {
    hoveredKey = key;
  }
</script>

<div class="start-menu-container" in:fade={{ duration: 300 }}>
  <div class="keyboard-wrapper">
    <div class="keyboard-header" in:fly={{ y: -20, delay: 100 }}>
      <h3><KeyboardIcon size={24} /> Virtual Control Panel</h3>
      <p>Interactive Keyboard Interface</p>
    </div>

    <div class="keyboard-body" in:fly={{ y: 20, delay: 200 }}>
      <div class="keyboard-container">
        {#each keyboardRows as row, i}
          <div class="keyboard-row">
            {#each row as key}
              <div 
                class="key" 
                class:hovered={hoveredKey === key}
                class:special={['Backspace', 'Tab', 'Caps', 'Enter', 'Shift', 'Space', 'Ctrl', 'Alt', 'Win', 'Menu', 'Esc'].includes(key) || key.startsWith('F')}
                class:wide={['Backspace', 'Tab', 'Caps', 'Enter', 'Shift', 'Ctrl', 'Alt', 'Win'].includes(key)}
                class:space={key === 'Space'}
                onmouseenter={() => handleKeyHover(key)}
                onmouseleave={() => hoveredKey = null}
              >
                <span class="key-label">{key}</span>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>

    <div class="keyboard-footer" class:visible={hoveredKey} in:fly={{ y: 10, delay: 300 }}>
      {#if hoveredKey}
        <div class="status-bar">
          <span class="status-icon">⌨️</span>
          <span class="status-text">Active Key: <strong>{hoveredKey}</strong></span>
        </div>
      {:else}
        <p class="status-placeholder">Move mouse over keys to interact</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .start-menu-container {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
  }

  .keyboard-wrapper {
    width: 100%;
    max-width: 1100px;
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .keyboard-header {
    text-align: center;
  }

  .keyboard-header h3 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: var(--space-2);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--color-text-primary);
  }

  .keyboard-header p {
    color: var(--color-text-muted);
    font-size: 1.1rem;
  }

  .keyboard-body {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    padding: var(--space-8);
    border-radius: 32px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .keyboard-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: var(--space-6);
    background: var(--color-bg-primary);
    border-radius: 20px;
    border: 1px solid var(--color-border);
  }

  .keyboard-row {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .key {
    min-width: 50px;
    height: 50px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: default;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 0 var(--color-border);
  }

  .key:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-cyan);
    transform: translateY(-4px);
    box-shadow: 0 8px 15px rgba(0, 210, 255, 0.2), 0 0 0 var(--color-border);
  }

  .key:active {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--color-border);
  }

  .key.special {
    background: var(--color-surface-1);
  }

  .key.wide {
    min-width: 80px;
    flex-grow: 1;
  }

  .key.space {
    min-width: 300px;
    flex-grow: 4;
  }

  .key-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    text-transform: uppercase;
  }

  .key:hover .key-label {
    color: var(--color-accent-cyan);
  }

  .keyboard-footer {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface-3);
    padding: 8px 20px;
    border-radius: 30px;
    border: 1px solid var(--color-accent-cyan);
    color: var(--color-text-primary);
  }

  .status-placeholder {
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
