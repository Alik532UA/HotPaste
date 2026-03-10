<script lang="ts">
  import { getState, closeTabSettings, updateTabSettings, renamePhysicalTab } from "../stores/appState.svelte";
  import { Layout, Type, Keyboard } from "lucide-svelte";
  import BaseModal from "./ui/BaseModal.svelte";
  import SegmentedToggle from "./ui/SegmentedToggle.svelte";
  import { t } from "../i18n";

  const appState = getState();
  const tab = $derived(appState.activeSettingsTab);

  /** Local form state */
  let displayName = $state("");
  let path = $state("");
  let icon = $state("");
  let color = $state("");
  let type = $state<"snippets" | "keyboard">("snippets");

  /** Color presets */
  const colorPresets = [
    { name: "Default", value: "" },
    { name: "Blue", value: "rgba(0, 113, 227, 0.15)" },
    { name: "Green", value: "rgba(0, 255, 136, 0.15)" },
    { name: "Violet", value: "rgba(123, 97, 255, 0.15)" },
    { name: "Red", value: "rgba(255, 75, 75, 0.15)" },
    { name: "Orange", value: "rgba(255, 159, 75, 0.15)" },
    { name: "Yellow", value: "rgba(255, 225, 75, 0.15)" },
    { name: "Pink", value: "rgba(255, 107, 157, 0.15)" },
  ];

  $effect(() => {
    if (tab) {
      displayName = tab.displayName || "";
      path = tab.path || "";
      icon = tab.icon || "";
      color = tab.color || "";
      type = tab.type || "snippets";
    }
  });

  async function handleSave() {
    if (tab) {
      // 1. Rename physical directory if changed
      if (path && path !== tab.path && tab.path !== '__root__') {
        await renamePhysicalTab(tab, path);
      }

      // 2. Update metadata
      await updateTabSettings(tab, {
        displayName: displayName || null,
        icon: icon || null,
        color: color || null,
        type: type,
      });
      closeTabSettings();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }
</script>

<BaseModal 
  isOpen={!!tab} 
  onClose={closeTabSettings}
  testId="tab-settings-modal"
>
  {#snippet header()}
    <div class="header-title-inner" data-testid="modal-header-inner">
      <Layout size={20} class="header-icon" />
      <h2 class="modal-title-text" data-testid="modal-title">{t.tabs.settings}</h2>
    </div>
  {/snippet}

  {#if tab}
    <!-- Tab Type -->
    <div class="form-group" data-testid="form-group-tab-type">
      <label for="tab-type-toggle" data-testid="label-tab-type">{t.tabs.type}</label>
      <SegmentedToggle
        id="tab-type-toggle"
        options={[
          { id: "snippets", label: t.tabs.typeSnippets, icon: Type },
          { id: "keyboard", label: t.tabs.typeKeyboard, icon: Keyboard }
        ]}
        value={type}
        onSelect={(v) => (type = v)}
      />
    </div>

    <!-- Display Name -->
    <div class="form-group" data-testid="form-group-tab-display-name">
      <label for="tab-display-name" data-testid="label-tab-display-name">{t.tabs.displayName}</label>
      <input
        id="tab-display-name"
        type="text"
        bind:value={displayName}
        onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
        placeholder={tab.path === '__root__' ? 'Файли' : tab.path}
        autocomplete="off"
        data-testid="input-tab-display-name"
      />
      <p class="field-hint" data-testid="hint-tab-display-name">{t.tabs.displayName} ({t.common.edit})</p>
    </div>

    <!-- Directory Name (Physical) -->
    {#if tab.path !== '__root__'}
      <div class="form-group" data-testid="form-group-tab-path">
        <label for="tab-path" data-testid="label-tab-path">{t.tabs.dirName}</label>
        <input
          id="tab-path"
          type="text"
          bind:value={path}
          onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
          placeholder="folder_name"
          autocomplete="off"
          data-testid="input-tab-path"
        />
        <p class="field-hint" data-testid="hint-tab-path">{t.tabs.dirName} (Warning: renames physical directory)</p>
      </div>
    {/if}

    <!-- Icon -->
    <div class="form-group" data-testid="form-group-tab-icon">
      <label for="tab-icon" data-testid="label-tab-icon">{t.tabs.icon} (Lucide/Emoji)</label>
      <input
        id="tab-icon"
        type="text"
        bind:value={icon}
        onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
        placeholder="Folder, Star, Layout, Keyboard..."

        data-testid="input-tab-icon"
      />
    </div>

    <!-- Color Picker -->
    <div class="form-group" data-testid="form-group-tab-color">
      <label for="tab-color-custom" data-testid="label-tab-color">{t.tabs.color}</label>
      <div class="color-grid" data-testid="tab-color-grid">
        {#each colorPresets as preset}
          <button
            class="color-swatch"
            class:active={color === preset.value}
            style="background-color: {preset.value || 'rgba(255,255,255,0.05)'}"
            onclick={() => (color = preset.value)}
            title={preset.name}
            data-testid="tab-color-preset-{preset.name.toLowerCase()}"
          ></button>
        {/each}
        <input 
          id="tab-color-custom" 
          type="color" 
          bind:value={color} 
          class="custom-color-picker" 
          data-testid="input-tab-custom-color"
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

  .btn-primary {
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
</style>
