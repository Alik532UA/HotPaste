<script lang="ts">
  import { getState, closeTabSettings, updateTabSettings, renamePhysicalTab } from "../stores/appState.svelte";
  import * as icons from "lucide-svelte";

  const appState = getState();
  const tab = $derived(appState.activeSettingsTab);

  /** Local form state */
  let displayName = $state("");
  let dirName = $state("");
  let icon = $state("");
  let color = $state("");

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

  $effect(() => {
    if (tab) {
      displayName = tab.displayName || "";
      dirName = tab.path === "__root__" ? "" : tab.path;
      icon = tab.icon || "";
      color = tab.color || "";
    }
  });

  async function handleSave() {
    if (tab) {
      // 1. Check for physical rename (only if not root)
      if (tab.path !== "__root__" && dirName && dirName !== tab.path) {
        await renamePhysicalTab(tab, dirName);
      }

      // 2. Update metadata
      await updateTabSettings(tab, {
        displayName: displayName || null,
        icon: icon || null,
        color: color || null,
      });
      closeTabSettings();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeTabSettings();
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }
</script>

{#if tab}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-overlay" onclick={closeTabSettings} onkeydown={handleKeydown} data-testid="modal-overlay">
    <div class="modal-content" onclick={(e) => e.stopPropagation()} data-testid="tab-settings-modal">
      <header class="modal-header">
        <div class="header-title" data-testid="modal-header-title">
          <icons.FolderCog size={20} class="header-icon" />
          <h2>Налаштувати вкладку</h2>
        </div>
        <button class="close-btn" onclick={closeTabSettings} data-testid="btn-modal-close">
          <icons.X size={20} />
        </button>
      </header>

      <div class="modal-body" data-testid="modal-body">
        <!-- Display Name -->
        <div class="form-group" data-testid="form-group-tab-display-name">
          <label for="tab-display-name" data-testid="label-tab-display-name">Відображувана назва</label>
          <input
            id="tab-display-name"
            type="text"
            bind:value={displayName}
            placeholder={tab.path === "__root__" ? "Файли" : tab.path}
            autocomplete="off"
            data-testid="input-tab-display-name"
          />
          <p class="field-hint" data-testid="hint-tab-display-name">Як вкладка підписана в інтерфейсі</p>
        </div>

        <!-- Directory Name (Physical) - Hide for root -->
        {#if tab.path !== "__root__"}
          <div class="form-group" data-testid="form-group-tab-dir-name">
            <label for="tab-dir-name" data-testid="label-tab-dir-name">Ім'я папки на диску</label>
            <input
              id="tab-dir-name"
              type="text"
              bind:value={dirName}
              placeholder="folder_name"
              autocomplete="off"
              data-testid="input-tab-dir-name"
            />
            <p class="field-hint" data-testid="hint-tab-dir-name">Увага: це змінить назву фізичної папки</p>
          </div>
        {/if}

        <!-- Icon -->
        <div class="form-group" data-testid="form-group-tab-icon">
          <label for="tab-icon-emoji" data-testid="label-tab-icon">Іконка (Emoji)</label>
          <input
            id="tab-icon-emoji"
            type="text"
            bind:value={icon}
            placeholder="📁, 🚀, 📝..."
            data-testid="input-tab-icon"
          />
        </div>

        <!-- Color Picker -->
        <div class="form-group" data-testid="form-group-tab-color">
          <label for="tab-color-custom" data-testid="label-tab-color">Колір вкладки</label>
          <div class="color-grid" data-testid="tab-color-presets-grid">
            {#each colorPresets as preset}
              <button
                class="color-swatch"
                class:active={color === preset.value}
                style="background-color: {preset.value || 'rgba(255,255,255,0.05)'}"
                onclick={() => (color = preset.value)}
                title={preset.name}
                data-testid="tab-color-preset"
                data-color={preset.value}
                data-color-name={preset.name}
              ></button>
            {/each}
            <input id="tab-color-custom" type="color" bind:value={color} class="custom-color-picker" data-testid="input-tab-color-custom" />
          </div>
        </div>
      </div>

      <footer class="modal-footer" data-testid="modal-footer">
        <span class="edit-hint" data-testid="modal-edit-hint">Ctrl+Enter — зберегти</span>
        <div class="footer-btns" data-testid="modal-footer-btns">
          <button class="btn-secondary" onclick={closeTabSettings} data-testid="btn-settings-cancel">Скасувати</button>
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
