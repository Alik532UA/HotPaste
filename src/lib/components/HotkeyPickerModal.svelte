<script lang="ts">
  import { getState, updateCardHotkey, closeHotkeyPicker } from "../stores/appState.svelte";
  import { X, Keyboard } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { CARD_CODES, getHotkeyLabel } from "../utils/keyboardLayout";
  import { t } from "../i18n";

  const appState = getState();
  const card = $derived(appState.activeHotkeyPickerCard);

  // Group keys into rows for the UI keyboard
  const rows = [
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
    ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"]
  ];

  function handleSelect(code: string) {
    if (card) {
      updateCardHotkey(card, code);
    }
  }

  function handleClear() {
    if (card) {
      updateCardHotkey(card, "");
    }
  }

  function handleReset() {
    if (card) {
      import("../stores/appState.svelte").then(m => m.resetCardHotkeyToDefault(card));
    }
  }

  function handleClose() {
    closeHotkeyPicker();
  }

  // Handle physical key press while modal is open
  function onKeydown(e: KeyboardEvent) {
    if (CARD_CODES.includes(e.code)) {
      e.preventDefault();
      handleSelect(e.code);
    } else if (e.code === "Escape") {
      handleClose();
    } else if (e.code === "Delete" || e.code === "Backspace") {
      handleClear();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if card}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onmousedown={handleClose} transition:fade={{ duration: 200 }}>
    <div 
        class="modal-content" 
        onmousedown={(e) => e.stopPropagation()} 
        transition:scale={{ duration: 300, start: 0.95 }}
    >
      <div class="modal-header">
        <div class="header-title">
          <Keyboard size={20} />
          <h2>{t.cards.hotkey}: {card.name}</h2>
        </div>
        <button class="btn-close" onclick={handleClose} aria-label={t.common.cancel}>
          <X size={20} />
        </button>
      </div>

      <div class="modal-body">
        <p class="description">
          {t.modals.pickerDesc}
        </p>

        <div class="keyboard-ui">
          {#each rows as row}
            <div class="keyboard-row">
              {#each row as code}
                <button 
                  class="key-btn" 
                  class:active={card.hotkey === code}
                  onclick={() => handleSelect(code)}
                >
                  <span class="key-label">{getHotkeyLabel(code)}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>

        <div class="actions-row">
          <button class="btn-reset" onclick={handleReset}>
            {t.common.default}
          </button>
          <button class="btn-clear" onclick={handleClear}>
            {t.common.disable}
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={handleClose}>{t.common.cancel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100; /* Higher than conflict modal */
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    width: 100%;
    max-width: 550px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
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
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 350px;
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

  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .description {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    text-align: center;
    margin: 0;
  }

  .keyboard-ui {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .keyboard-row {
    display: flex;
    gap: 6px;
  }

  .key-btn {
    width: 42px;
    height: 42px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .key-btn:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-violet);
    transform: translateY(-2px);
  }

  .key-btn.active {
    background: var(--color-accent-violet);
    border-color: var(--color-accent-violet);
    color: white;
  }

  .key-label {
    font-size: 1.1rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .actions-row {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .btn-reset {
    padding: 10px 20px;
    background: rgba(0, 210, 255, 0.1);
    border: 1px solid rgba(0, 210, 255, 0.3);
    border-radius: 12px;
    color: var(--color-accent-cyan);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reset:hover {
    background: rgba(0, 210, 255, 0.2);
    border-color: var(--color-accent-cyan);
  }

  .btn-clear {
    padding: 10px 20px;
    background: rgba(255, 75, 75, 0.1);
    border: 1px solid rgba(255, 75, 75, 0.3);
    border-radius: 12px;
    color: #ff4b4b;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-clear:hover {
    background: rgba(255, 75, 75, 0.2);
    border-color: #ff4b4b;
  }

  .modal-footer {
    padding: 16px 24px;
    background: var(--color-bg-primary);
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
  }

  .btn-secondary {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--color-surface-2);
  }

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .key-btn {
      width: 36px;
      height: 36px;
    }
    .key-label {
      font-size: 0.9rem;
    }
  }
</style>
