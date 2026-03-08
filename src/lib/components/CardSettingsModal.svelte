<script lang="ts">
  import { getState, closeSettings, updateCardSettings, renamePhysicalFile } from "../stores/appState.svelte";
  import * as icons from "lucide-svelte";

  const appState = getState();
  const card = $derived(appState.activeSettingsCard);

  /** Local form state */
  let displayName = $state("");
  let fileName = $state("");
  let hotkey = $state("");
  let icon = $state("");
  let color = $state("");
  let borderColor = $state("");

  /** Color presets */
  const colorPresets = [
    { name: "Default", value: "" },
    { name: "Slate", value: "#1e293b" },
    { name: "Zinc", value: "#18181b" },
    { name: "Stone", value: "#1c1917" },
    { name: "Red", value: "#450a0a" },
    { name: "Orange", value: "#431407" },
    { name: "Amber", value: "#451a03" },
    { name: "Yellow", value: "#422006" },
    { name: "Green", value: "#052e16" },
    { name: "Emerald", value: "#064e3b" },
    { name: "Teal", value: "#134e4a" },
    { name: "Cyan", value: "#164e63" },
    { name: "Blue", value: "#1e3a8a" },
    { name: "Indigo", value: "#312e81" },
    { name: "Violet", value: "#4c1d95" },
    { name: "Purple", value: "#581c87" },
    { name: "Fuchsia", value: "#701a75" },
    { name: "Pink", value: "#831843" },
    { name: "Rose", value: "#881337" },
  ];

  const borderPresets = [
    { name: "Default", value: "" },
    { name: "Cyan", value: "#00d2ff" },
    { name: "Violet", value: "#7b61ff" },
    { name: "Green", value: "#00ff88" },
    { name: "Red", value: "#ff4b4b" },
    { name: "Orange", value: "#ff9f4b" },
    { name: "Yellow", value: "#ffe14b" },
    { name: "White", value: "rgba(255,255,255,0.2)" },
    { name: "Invisible", value: "transparent" },
  ];

  $effect(() => {
    if (card) {
      displayName = card.displayName || "";
      fileName = card.fileName || "";
      hotkey = card.hotkey || "";
      icon = card.icon || "";
      color = card.color || "";
      borderColor = card.borderColor || "";
    }
  });

  async function handleSave() {
    if (card) {
      if (fileName && fileName !== card.fileName) {
        await renamePhysicalFile(card, fileName);
      }

      await updateCardSettings(card, {
        displayName: displayName || null,
        hotkey: hotkey || "",
        icon: icon || null,
        color: color || null,
        borderColor: borderColor || null,
      } as any);
      closeSettings();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeSettings();
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }

  /** Capture physical key code */
  function handleHotkeyKeydown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    // Ignore modifiers only if they are pressed alone
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    
    if (e.key === 'Backspace' || e.key === 'Delete') {
      hotkey = "";
      return;
    }

    hotkey = e.code;
  }
</script>

{#if card}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeSettings} onkeydown={handleKeydown} data-testid="modal-overlay">
    <div class="modal-content" onclick={(e) => e.stopPropagation()} data-testid="card-settings-modal">
      <header class="modal-header">
        <div class="header-title" data-testid="modal-header-title">
          <icons.Settings size={20} class="header-icon" />
          <h2>Налаштувати картку</h2>
        </div>
        <button class="close-btn" onclick={closeSettings} data-testid="btn-modal-close">
          <icons.X size={20} />
        </button>
      </header>

      <div class="modal-body" data-testid="modal-body">
        <!-- Display Name -->
        <div class="form-group" data-testid="form-group-display-name">
          <label for="display-name" data-testid="label-display-name">Відображувана назва</label>
          <input
            id="display-name"
            type="text"
            bind:value={displayName}
            placeholder={card.fileName}
            autocomplete="off"
            data-testid="input-display-name"
          />
          <p class="field-hint" data-testid="hint-display-name">Як картка підписана в інтерфейсі</p>
        </div>

        <!-- File Name (Physical) -->
        <div class="form-group" data-testid="form-group-file-name">
          <label for="file-name" data-testid="label-file-name">Ім'я файлу на диску</label>
          <input
            id="file-name"
            type="text"
            bind:value={fileName}
            placeholder="example.txt"
            autocomplete="off"
            data-testid="input-file-name"
          />
          <p class="field-hint" data-testid="hint-file-name">Увага: це змінить назву фізичного файлу</p>
        </div>

        <div class="form-row" data-testid="form-row-hotkey-icon">
          <!-- Hotkey -->
          <div class="form-group flex-1" data-testid="form-group-hotkey">
            <label for="hotkey-cap" data-testid="label-card-hotkey">Гаряча клавіша</label>
            <input
              id="hotkey-cap"
              type="text"
              readonly
              value={appState.getHotkeyLabel(hotkey)}
              onkeydown={handleHotkeyKeydown}
              placeholder="Натисніть клавішу"
              class="hotkey-input"
              title="Фокус і натискання будь-якої клавіші змінить гарячу клавішу"
              data-testid="input-card-hotkey"
            />
            <p class="field-hint" data-testid="hint-card-hotkey">Фізична кнопка (не залежить від мови)</p>
          </div>

          <!-- Icon -->
          <div class="form-group flex-2" data-testid="form-group-icon">
            <label for="icon-name" data-testid="label-card-icon">Іконка (Lucide або Emoji)</label>
            <input
              id="icon-name"
              type="text"
              bind:value={icon}
              placeholder="Copy, Edit, 📁, 🚀..."
              data-testid="input-card-icon"
            />
          </div>
        </div>

        <!-- Color Picker -->
        <div class="form-group" data-testid="form-group-color">
          <label for="bg-color-custom" data-testid="label-card-color">Колір фону</label>
          <div class="color-grid" data-testid="color-presets-grid">
            {#each colorPresets as preset}
              <button
                class="color-swatch"
                class:active={color === preset.value}
                style="background-color: {preset.value || 'rgba(255,255,255,0.05)'}"
                onclick={() => (color = preset.value)}
                title={preset.name}
                data-testid="color-preset"
                data-color={preset.value}
                data-color-name={preset.name}
              ></button>
            {/each}
            <input id="bg-color-custom" type="color" bind:value={color} class="custom-color-picker" data-testid="input-card-color-custom" />
          </div>
        </div>

        <!-- Border Picker -->
        <div class="form-group" data-testid="form-group-border">
          <label for="border-color-custom" data-testid="label-card-border">Колір обводки</label>
          <div class="color-grid" data-testid="border-presets-grid">
            {#each borderPresets as preset}
              <button
                class="color-swatch"
                class:active={borderColor === preset.value}
                style="background-color: {preset.value || 'rgba(255,255,255,0.05)'}; border: 1px solid {preset.value || 'var(--color-border)'}"
                onclick={() => (borderColor = preset.value)}
                title={preset.name}
                data-testid="border-preset"
                data-color={preset.value}
                data-color-name={preset.name}
              ></button>
            {/each}
            <input id="border-color-custom" type="color" bind:value={borderColor} class="custom-color-picker" data-testid="input-card-border-custom" />
          </div>
        </div>
      </div>

      <footer class="modal-footer" data-testid="modal-footer">
        <span class="edit-hint" data-testid="modal-edit-hint">Ctrl+Enter — зберегти</span>
        <div class="footer-btns" data-testid="modal-footer-btns">
          <button class="btn-secondary" onclick={closeSettings} data-testid="btn-settings-cancel">Скасувати</button>
          <button class="btn-primary" onclick={handleSave} data-testid="btn-settings-save">Зберегти зміни</button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    width: 100%;
    max-width: 480px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
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

  :global(.modal-header .header-icon) {
    color: var(--color-accent-violet);
  }

  .modal-header h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: 70vh;
    overflow-y: auto;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-row {
    display: flex;
    gap: 16px;
  }

  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  input[type="text"] {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--color-accent-violet);
    background: var(--color-surface-3);
  }

  .hotkey-input {
    text-align: center;
    font-family: var(--font-mono);
    text-transform: uppercase;
    font-weight: bold;
    cursor: pointer;
    caret-color: transparent;
  }

  .hotkey-input:focus {
    background: var(--color-accent-violet-transparent, rgba(123, 97, 255, 0.1));
    border-color: var(--color-accent-violet);
  }

  .field-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
    gap: 8px;
    align-items: center;
  }

  .color-swatch {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: transform 0.1s, border-color 0.2s;
  }

  .color-swatch:hover {
    transform: scale(1.1);
  }

  .color-swatch.active {
    border-color: white;
    box-shadow: 0 0 0 2px var(--color-accent-violet);
  }

  .custom-color-picker {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .modal-footer {
    padding: 20px 24px;
    background: var(--color-surface-1);
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .edit-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .footer-btns {
    display: flex;
    gap: 12px;
  }

  .btn-primary, .btn-secondary {
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .btn-primary {
    background: var(--color-accent-violet);
    color: white;
    border: none;
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(123, 97, 255, 0.3);
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }

  .btn-secondary:hover {
    background: var(--color-surface-2);
  }
</style>
