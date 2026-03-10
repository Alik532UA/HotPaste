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
    { name: "Cyan", value: "var(--color-accent-cyan)" },
    { name: "Violet", value: "var(--color-accent-violet)" },
    { name: "Green", value: "var(--color-success)" },
    { name: "Red", value: "var(--color-danger)" },
    { name: "Orange", value: "var(--color-warning)" },
    { name: "White", value: "color-mix(in srgb, white 20%, transparent)" },
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
    <div class="header-title-inner" data-testid="modal-header-inner">
      <Settings size={20} class="header-icon" />
      <h2 class="modal-title-text" data-testid="modal-title">{t.cards.settings}</h2>
    </div>
  {/snippet}

  {#if card}
    <!-- Display Name -->
    <div class="form-group" data-testid="form-group-display-name">
      <label for="display-name" data-testid="label-display-name">{t.cards.displayName}</label>
      <input
        id="display-name"
        type="text"
        bind:value={displayName}
        onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
        placeholder={card.fileName}
        autocomplete="off"
        data-testid="input-display-name"
      />
      <p class="field-hint" data-testid="hint-display-name">{t.cards.displayName} ({t.common.edit})</p>
    </div>

    <!-- File Name (Physical) -->
    <div class="form-group" data-testid="form-group-file-name">
      <label for="file-name" data-testid="label-file-name">{t.cards.fileName}</label>
      <input
        id="file-name"
        type="text"
        bind:value={fileName}
        onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
        placeholder="example.txt"
        autocomplete="off"
        data-testid="input-file-name"
      />
      <p class="field-hint" data-testid="hint-file-name">{t.cards.fileName} (Warning: renames physical file)</p>
    </div>

    <div class="form-row" data-testid="form-row-hotkey-icon">
      <!-- Hotkey -->
      <div class="form-group flex-1" data-testid="form-group-hotkey">
        <label for="hotkey-cap" data-testid="label-hotkey">{t.cards.hotkey}</label>
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
        <p class="field-hint" data-testid="hint-hotkey">{t.cards.hotkey} (Physical code)</p>
      </div>

      <!-- Icon -->
      <div class="form-group flex-2" data-testid="form-group-icon">
        <label for="icon-name" data-testid="label-icon">{t.cards.icon} (Lucide/Emoji)</label>
        <input
          id="icon-name"
          type="text"
          bind:value={icon}
          onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
          placeholder="Copy, Edit, Folder, Star..."
          data-testid="input-card-icon"
        />
      </div>
    </div>

    <!-- Color Picker -->
    <div class="form-group" data-testid="form-group-color">
      <label for="bg-color-custom" data-testid="label-color">{t.cards.color}</label>
      <div class="color-grid" data-testid="color-grid">
        {#each colorPresets as preset}
          <button
            class="color-swatch"
            class:active={color === preset.value}
            style="background-color: {preset.value || 'var(--color-surface-2)'}"
            onclick={() => (color = preset.value)}
            title={preset.name}
            data-testid="color-preset-{preset.name.toLowerCase()}"
          ></button>
        {/each}
        <input 
          id="bg-color-custom" 
          type="color" 
          bind:value={color} 
          class="custom-color-picker" 
          data-testid="input-custom-color"
        />
      </div>
    </div>

    <!-- Border Picker -->
    <div class="form-group" data-testid="form-group-border">
      <label for="border-color-custom" data-testid="label-border">{t.cards.border}</label>
      <div class="color-grid" data-testid="border-grid">
        {#each borderPresets as preset}
          <button
            class="color-swatch"
            class:active={borderColor === preset.value}
            style="background-color: {preset.value || 'var(--color-surface-2)'}; border: 1px solid {preset.value || 'var(--color-border)'}"
            onclick={() => (borderColor = preset.value)}
            title={preset.name}
            data-testid="border-preset-{preset.name.toLowerCase()}"
          ></button>
        {/each}
        <input 
          id="border-color-custom" 
          type="color" 
          bind:value={borderColor} 
          class="custom-color-picker" 
          data-testid="input-custom-border"
        />
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <div class="footer-inner" data-testid="modal-footer-inner">
      <span class="edit-hint" data-testid="edit-hint">Ctrl+Enter — {t.common.save}</span>
      <div class="footer-btns">
        <button 
          class="btn-primary" 
          onclick={handleSave}
          data-testid="btn-modal-save"
        >
          {t.common.save}
        </button>
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
    font-weight: 700;
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
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  input[type="text"] {
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 12px 16px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--color-accent-violet);
    background: var(--color-bg-primary);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent-violet) 10%, transparent);
  }

  .hotkey-input {
    text-align: center;
    font-family: var(--font-mono);
    text-transform: uppercase;
    font-weight: 800;
    cursor: pointer;
    caret-color: transparent;
    color: var(--color-accent-violet) !important;
  }

  .field-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    opacity: 0.8;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    gap: 10px;
    align-items: center;
    padding: 12px;
    background: var(--color-surface-1);
    border-radius: 14px;
    border: 1px solid var(--color-border);
  }

  .color-swatch {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, white 10%, transparent);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .color-swatch:hover {
    transform: scale(1.15) rotate(5deg);
    z-index: 2;
    box-shadow: var(--shadow-md);
  }

  .color-swatch.active {
    border-color: white;
    transform: scale(1.1);
    box-shadow: 0 0 0 3px var(--color-accent-violet);
  }

  .custom-color-picker {
    width: 36px;
    height: 36px;
    padding: 0;
    border: 2px solid var(--color-border);
    border-radius: 8px;
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
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .footer-btns {
    display: flex;
    gap: 12px;
  }

  .btn-primary {
    padding: 12px 24px;
    border-radius: 14px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
    background: var(--color-accent-violet);
    color: white;
    border: none;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-violet) 30%, transparent);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
    box-shadow: 0 8px 20px color-mix(in srgb, var(--color-accent-violet) 45%, transparent);
  }
</style>
