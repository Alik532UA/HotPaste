<script lang="ts">
  import { getState, closeSettings, updateCardSettings, renamePhysicalFile } from "../stores/appState.svelte";
  import { Settings } from "lucide-svelte";
  import BaseModal from "./ui/BaseModal.svelte";
  import { t } from "../i18n";

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
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }

  /** Capture physical key code */
  function handleHotkeyKeydown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    
    if (e.key === 'Backspace' || e.key === 'Delete') {
      hotkey = "";
      return;
    }

    hotkey = e.code;
  }
</script>

<BaseModal 
  isOpen={!!card} 
  onClose={closeSettings}
  testId="card-settings-modal"
>
  {#snippet header()}
    <div class="header-title-inner">
      <Settings size={20} class="header-icon" />
      <h2 class="modal-title-text">{t.cards.settings}</h2>
    </div>
  {/snippet}

  {#if card}
    <!-- Display Name -->
    <div class="form-group" data-testid="form-group-display-name">
      <label for="display-name">{t.cards.displayName}</label>
      <input
        id="display-name"
        type="text"
        bind:value={displayName}
        onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
        placeholder={card.fileName}
        autocomplete="off"
        data-testid="input-display-name"
      />
      <p class="field-hint">{t.cards.displayName} ({t.common.edit})</p>
    </div>

    <!-- File Name (Physical) -->
    <div class="form-group" data-testid="form-group-file-name">
      <label for="file-name">{t.cards.fileName}</label>
      <input
        id="file-name"
        type="text"
        bind:value={fileName}
        onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
        placeholder="example.txt"
        autocomplete="off"
        data-testid="input-file-name"
      />
      <p class="field-hint">{t.cards.fileName} (Warning: renames physical file)</p>
    </div>

    <div class="form-row">
      <!-- Hotkey -->
      <div class="form-group flex-1" data-testid="form-group-hotkey">
        <label for="hotkey-cap">{t.cards.hotkey}</label>
        <input
          id="hotkey-cap"
          type="text"
          readonly
          value={appState.getHotkeyLabel(hotkey)}
          onkeydown={(e) => { e.stopPropagation(); handleHotkeyKeydown(e); }}
          placeholder={t.modals.pickerTitle}
          class="hotkey-input"
          title={t.cards.hotkeyChange}
          data-testid="input-card-hotkey"
        />
        <p class="field-hint">{t.cards.hotkey} (Physical code)</p>
      </div>

      <!-- Icon -->
      <div class="form-group flex-2" data-testid="form-group-icon">
        <label for="icon-name">{t.cards.icon} (Lucide/Emoji)</label>
        <input
          id="icon-name"
          type="text"
          bind:value={icon}
          onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
          placeholder="Copy, Edit, 📁, 🚀..."
          data-testid="input-card-icon"
        />
      </div>
    </div>

    <!-- Color Picker -->
    <div class="form-group">
      <label for="bg-color-custom">{t.cards.color}</label>
      <div class="color-grid">
        {#each colorPresets as preset}
          <button
            class="color-swatch"
            class:active={color === preset.value}
            style="background-color: {preset.value || 'rgba(255,255,255,0.05)'}"
            onclick={() => (color = preset.value)}
            title={preset.name}
            data-testid="color-preset"
          ></button>
        {/each}
        <input id="bg-color-custom" type="color" bind:value={color} class="custom-color-picker" />
      </div>
    </div>

    <!-- Border Picker -->
    <div class="form-group">
      <label for="border-color-custom">{t.cards.border}</label>
      <div class="color-grid">
        {#each borderPresets as preset}
          <button
            class="color-swatch"
            class:active={borderColor === preset.value}
            style="background-color: {preset.value || 'rgba(255,255,255,0.05)'}; border: 1px solid {preset.value || 'var(--color-border)'}"
            onclick={() => (borderColor = preset.value)}
            title={preset.name}
            data-testid="border-preset"
          ></button>
        {/each}
        <input id="border-color-custom" type="color" bind:value={borderColor} class="custom-color-picker" />
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <div class="footer-inner">
      <span class="edit-hint">Ctrl+Enter — {t.common.save}</span>
      <div class="footer-btns">
        <button class="btn-secondary" onclick={closeSettings}>{t.common.cancel}</button>
        <button class="btn-primary" onclick={handleSave}>{t.common.save}</button>
      </div>
    </div>
  {/snippet}
</BaseModal>

<style>
  .header-title-inner {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  :global(.header-icon) {
    color: var(--color-accent-violet);
  }

  .modal-title-text {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    color: var(--color-text-primary);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-row {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
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

  .footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
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
