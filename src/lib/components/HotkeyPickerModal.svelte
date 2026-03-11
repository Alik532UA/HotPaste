<script lang="ts">
  import { getState, updateCardHotkey, closeHotkeyPicker, resetCardHotkeyToDefault } from "../stores/appState.svelte";
  import { X, Keyboard } from "lucide-svelte";
  import { fade, scale } from "svelte/transition";
  import { CARD_CODES, getHotkeyLabel } from "../utils/keyboardLayout";
  import { t } from "../i18n";

  const appState = getState();
  const pickerState = $derived(appState.activeHotkeyPicker);
  const card = $derived(pickerState?.card);

  // Group keys into rows for the UI keyboard
  const rows = [
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL"],
    ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"]
  ];

  function handleSelect(code: string) {
    if (pickerState) {
      if (pickerState.onSelect) {
        pickerState.onSelect(code);
      } else if (card) {
        updateCardHotkey(card, code);
      }
      handleClose();
    }
  }

  function handleClear() {
    if (pickerState) {
      if (pickerState.onSelect) {
        pickerState.onSelect("");
      } else if (card) {
        updateCardHotkey(card, "");
      }
      handleClose();
    }
  }

  function handleReset() {
    if (pickerState) {
      if (pickerState.onSelect) {
        pickerState.onSelect(""); // Fallback to clear for draft mode
      } else if (card) {
        resetCardHotkeyToDefault(card);
      }
      handleClose();
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
  <div 
    class="modal-backdrop" 
    onmousedown={handleClose} 
    transition:fade={{ duration: 200 }}
    data-testid="modal-overlay"
  >
    <div 
        class="modal-content" 
        onmousedown={(e) => e.stopPropagation()} 
        transition:scale={{ duration: 300, start: 0.95 }}
        data-testid="hotkey-picker-modal"
    >
      <div class="modal-header" data-testid="modal-header">
        <div class="header-title">
          <Keyboard size={20} />
          <h2 data-testid="modal-title">{t.cards.hotkey}: {card.name}</h2>
        </div>
        <button 
          class="btn-close" 
          onclick={handleClose} 
          aria-label={t.common.cancel}
          data-testid="btn-modal-close"
        >
          <X size={20} />
        </button>
      </div>

      <div class="modal-body" data-testid="modal-body">
        <p class="description" data-testid="picker-description">
          {t.modals.pickerDesc}
        </p>

        <div class="keyboard-ui" data-testid="keyboard-ui">
          {#each rows as row}
            <div class="keyboard-row">
              {#each row as code}
                <button 
                  class="key-btn" 
                  class:active={card.hotkey === code}
                  class:is-custom={card.isCustomHotkey}
                  onclick={() => handleSelect(code)}
                  data-testid="key-{code}"
                  data-active={card.hotkey === code}
                  data-custom={card.isCustomHotkey}
                >
                  <span class="key-label">{getHotkeyLabel(code)}</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>

        <div class="actions-row">
          <button 
            class="btn-reset" 
            onclick={handleReset}
            data-testid="btn-hotkey-reset"
          >
            {t.common.default}
          </button>
          <button 
            class="btn-clear" 
            onclick={handleClear}
            data-testid="btn-hotkey-clear"
          >
            {t.common.disable}
          </button>
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
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000; /* Above BaseModal (2000) */
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    width: 100%;
    max-width: 550px;
    box-shadow: var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 5%, transparent) inset;
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
    background: var(--color-surface-1);
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 350px;
    color: var(--color-text-primary);
  }

  .btn-close {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .btn-close:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
    transform: rotate(90deg);
  }

  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    background: var(--color-bg-secondary);
  }

  .description {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .keyboard-ui {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    padding: 10px;
    background: var(--color-surface-1);
    border-radius: 16px;
    border: 1px solid var(--color-border);
  }

  .keyboard-row {
    display: flex;
    gap: 6px;
  }

  .key-btn {
    width: 44px;
    height: 44px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    box-shadow: var(--shadow-sm);
  }

  .key-btn:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-violet);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-violet) 20%, transparent);
  }

  .key-btn.active {
    background: var(--color-accent-violet);
    border-color: var(--color-accent-violet);
    color: var(--color-bg-primary);
    transform: scale(1.05);
  }

  .key-btn.active .key-label {
    color: var(--color-bg-primary);
  }

  /* Automatic hotkey (not custom) — show only border and text color, no fill */
  .key-btn.active:not(.is-custom) {
    background: color-mix(in srgb, var(--color-accent-violet) 15%, var(--color-bg-secondary));
    border: 2px dashed var(--color-accent-violet);
    color: var(--color-accent-violet);
    transform: none;
  }

  .key-btn.active:not(.is-custom) .key-label {
    color: var(--color-accent-violet);
  }

  .key-label {
    font-size: 1.1rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--color-text-primary);
  }

  .actions-row {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding-top: 8px;
  }

  .btn-reset {
    padding: 12px 24px;
    background: color-mix(in srgb, var(--color-accent-cyan) 10%, var(--color-bg-secondary));
    border: 1px solid color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
    border-radius: 14px;
    color: var(--color-accent-cyan);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reset:hover {
    background: var(--color-accent-cyan);
    color: var(--color-bg-primary);
    border-color: var(--color-accent-cyan);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
  }

  .btn-clear {
    padding: 12px 24px;
    background: color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-secondary));
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    border-radius: 14px;
    color: var(--color-danger);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-clear:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-danger) 30%, transparent);
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
