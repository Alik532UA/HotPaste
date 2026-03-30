<script lang="ts">
  import { getState, closeSettings, updateCardSettings, renamePhysicalFile, openIconPicker, openHotkeyPicker } from "../stores/appState.svelte";
  import { Settings, Search, Keyboard, X as CloseIcon, Type, FileText, Palette, Eye, AlertCircle, ChevronRight, Check, Plus, MousePointer2 } from "lucide-svelte";
  import * as LucideIcons from "lucide-svelte";
  import BaseModal from "./ui/BaseModal.svelte";
  import Input from "./ui/Input.svelte";
  import IconRenderer from "./ui/IconRenderer.svelte";
  import { t } from "../i18n";
  import type { Card } from "../types";
  import SnippetCard from "./SnippetCard.svelte";
  import { untrack } from "svelte";
  import { uiState } from "../stores/uiState.svelte";

  const appState = getState();
  const card = $derived(appState.activeSettingsCard);

  /** Local form state */
  let currentCardId = $state<string | null>(null);
  let displayName = $state("");
  let fileName = $state("");
  let hotkey = $state("");
  let icon = $state("");
  let color = $state("");
  let borderColor = $state("");
  let confirmCount = $state(1);

  /** Color presets from theme */
  const colorPresets = [
    { name: "Default", value: "" },
    ...Array.from({ length: 22 }, (_, i) => ({
      name: `Color ${i + 1}`,
      value: `var(--palette-${i + 1})`
    }))
  ];

  const borderPresets = [
    { name: "Default", value: "" },
    ...Array.from({ length: 22 }, (_, i) => ({
      name: `Border ${i + 1}`,
      value: `var(--palette-${i + 1})`
    }))
  ];

  /** Preview Card state */
  const previewCard = $derived(card ? {
    ...card,
    displayName: displayName || null,
    name: displayName || card.fileName,
    hotkey,
    icon,
    color: color || null,
    borderColor: borderColor || null,
    confirmCount,
  } as Card : null);

  $effect(() => {
    if (card && card.id !== currentCardId) {
      untrack(() => {
        currentCardId = card.id;
        displayName = card.displayName || "";
        fileName = card.fileName || "";
        hotkey = card.hotkey || "";
        icon = card.icon || "";
        color = card.color || "";
        borderColor = card.borderColor || "";
        confirmCount = card.confirmCount || 1;
      });
    }
  });

  async function handleSave() {
    if (card) {
      try {
        if (fileName && fileName !== card.fileName) {
          await renamePhysicalFile(card, fileName);
        }

        await updateCardSettings(card, {
          displayName: displayName || null,
          hotkey: hotkey || "",
          icon: icon || null,
          color: color || null,
          borderColor: borderColor || null,
          confirmCount: confirmCount || 1,
        } as any);
        closeSettings();
      } catch (error) {
        console.error("Failed to save card settings:", error);
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }

  function handleClearHotkey(e: MouseEvent) {
    e.stopPropagation();
    hotkey = "";
  }

  function handleClearIcon(e: MouseEvent) {
    e.stopPropagation();
    icon = "";
  }
</script>

<BaseModal 
  isOpen={!!card} 
  onClose={closeSettings}
  testId="card-settings-modal"
  maxWidth="950px"
>
  {#snippet header()}
    <div class="header-title-inner" data-testid="modal-header-inner">
      <div class="header-icon-bg">
        <Settings size={20} class="header-icon" />
      </div>
      <h2 class="modal-title-text" data-testid="modal-title">{t.cards.settings}</h2>
    </div>
  {/snippet}

  {#if card}
    <div class="modal-content-layout" data-testid="modal-content-container">
      
      <div class="modal-sections-grid" data-testid="settings-grid">
        <!-- Column 1: Preview -->
        <div class="grid-column" data-testid="column-preview">
          <section class="form-section" data-testid="section-preview">
            <div class="section-header" data-testid="preview-header">
              <Eye size={14} />
              <span>{t.common.preview}</span>
            </div>
            <div class="preview-container" data-testid="card-preview-container">
              {#if previewCard}
                <div class="preview-wrapper" data-testid="snippet-card-wrapper">
                  <SnippetCard card={previewCard} />
                </div>
              {/if}
            </div>
          </section>
        </div>

        <!-- Column 2: General & Identity -->
        <div class="grid-column" data-testid="column-content-identity">
          <!-- Section 1: General Info -->
          <section class="form-section" data-testid="section-content">
            <div class="section-header" data-testid="content-header">
              <Type size={14} />
              <span>{t.cards.general}</span>
            </div>
            <div class="section-body" data-testid="content-body">
              <div class="form-group">
                <label for="display-name-input">{t.cards.displayName}</label>
                <Input
                  id="display-name-input"
                  bind:value={displayName}
                  onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
                  placeholder={card.fileName}
                  testId="input-display-name"
                />
              </div>

              <div class="form-group" data-testid="file-name-group">
                <label for="file-name-input">{t.cards.fileName}</label>
                <Input
                  id="file-name-input"
                  bind:value={fileName}
                  onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
                  placeholder="example.txt"
                  testId="input-file-name"
                  hint={t.cards.fileNameHint}
                />
              </div>
            </div>
          </section>

          <!-- Section 2: Identity (Icon & Hotkey) -->
          <section class="form-section" data-testid="section-identity">
            <div class="section-header" data-testid="identity-header">
              <Keyboard size={14} />
              <span>{t.cards.identity}</span>
            </div>
            <div class="section-body compact-identity" data-testid="identity-body">
              <!-- Icon Row -->
              <div class="identity-row" data-testid="identity-row-icon">
                <span class="identity-label">{t.cards.icon}</span>
                <div class="identity-controls">
                  <button
                    class="action-square-btn"
                    class:active={!!icon}
                    onclick={() => openIconPicker(icon, (v) => (icon = v), t.cards.settings)}
                    data-testid="btn-card-icon-picker"
                    title={t.cards.icon}
                  >
                    {#if icon}
                      <IconRenderer icon={icon} size={20} />
                    {:else}
                      <Plus size={20} />
                    {/if}
                  </button>
                  
                  <div class="delete-slot">
                    {#if icon}
                      <button
                        class="delete-action-btn"
                        onclick={(e) => { e.stopPropagation(); handleClearIcon(e); }}
                        title={t.common.delete}
                        data-testid="btn-clear-icon"
                      >
                        <CloseIcon size={14} />
                      </button>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Hotkey Row -->
              <div class="identity-row" data-testid="identity-row-hotkey">
                <span class="identity-label">{t.cards.hotkey}</span>
                <div class="identity-controls">
                  <button
                    class="action-square-btn"
                    class:active={!!hotkey}
                    onclick={() => openHotkeyPicker(card, (code) => { hotkey = code; })}
                    data-testid="btn-card-hotkey-picker"
                    title={t.cards.hotkey}
                  >
                    {#if hotkey}
                      <span class="hotkey-text-compact">{appState.getHotkeyLabel(hotkey)}</span>
                    {:else}
                      <Plus size={20} />
                    {/if}
                  </button>

                  <div class="delete-slot">
                    {#if hotkey}
                      <button
                        class="delete-action-btn"
                        onclick={(e) => { e.stopPropagation(); handleClearHotkey(e); }}
                        title={t.common.delete}
                        data-testid="btn-clear-hotkey"
                      >
                        <CloseIcon size={14} />
                      </button>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Confirmation Row -->
              <div class="identity-row">
                <span class="identity-label">Кількість натискань</span>
                <div class="identity-controls">
                    <input 
                        type="number" 
                        min="1" 
                        max="10" 
                        bind:value={confirmCount} 
                        class="confirm-input"
                    />
                    <span class="hint">1 = миттєво</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Column 3: Appearance -->
        <div class="grid-column" data-testid="column-appearance">
          <!-- Section 3: Appearance -->
          <section class="form-section" data-testid="section-appearance">
            <div class="section-header" data-testid="appearance-header">
              <Palette size={14} />
              <span>{t.cards.appearance}</span>
            </div>
            <div class="section-body" data-testid="appearance-body">
              <!-- Color Picker -->
              <div class="form-group" data-testid="form-group-color">
                <span class="form-label">{t.cards.color}</span>
                <div class="color-picker-grid-container" data-testid="color-picker-container">
                  <div class="color-grid" data-testid="color-picker-grid">
                    {#each colorPresets as preset}
                      <button
                        class="color-swatch"
                        class:active={color === preset.value}
                        style="background-color: {preset.value || 'var(--color-surface-2)'}"
                        onclick={() => (color = preset.value)}
                        title={preset.name}
                        data-testid="btn-color-{preset.name.toLowerCase()}"
                      >
                        {#if color === preset.value}
                          <Check size={14} class="check-icon" data-testid="check-mark-color-{preset.name.toLowerCase()}" />
                        {/if}
                      </button>
                    {/each}
                    
                    <!-- Integrated Custom Color -->
                    <div class="custom-color-swatch-wrapper" title={t.common.custom}>
                      <input 
                        type="color" 
                        bind:value={color} 
                        class="custom-color-input-hidden" 
                        id="custom-color-trigger"
                        data-testid="input-custom-color"
                      />
                      <label for="custom-color-trigger" class="color-swatch custom-trigger" data-testid="btn-custom-color">
                        <Palette size={14} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Border Picker -->
              <div class="form-group" data-testid="form-group-border">
                <span class="form-label">{t.cards.border}</span>
                <div class="color-picker-grid-container" data-testid="border-picker-container">
                  <div class="color-grid" data-testid="border-picker-grid">
                    {#each borderPresets as preset}
                      <button
                        class="color-swatch border-swatch"
                        class:active={borderColor === preset.value}
                        style="border: 4px solid {preset.value || 'var(--color-border)'}"
                        onclick={() => (borderColor = preset.value)}
                        title={preset.name}
                        data-testid="btn-border-{preset.name.toLowerCase()}"
                      >
                        <div class="inner-swatch" style="background-color: color-mix(in srgb, {preset.value || 'var(--color-border)'} 15%, transparent)" data-testid="inner-swatch-{preset.name.toLowerCase()}"></div>
                        {#if borderColor === preset.value}
                          <Check size={14} class="check-icon" data-testid="check-mark-border-{preset.name.toLowerCase()}" />
                        {/if}
                      </button>
                    {/each}

                    <!-- Integrated Custom Border -->
                    <div class="custom-color-swatch-wrapper" title={t.common.custom}>
                      <input 
                        type="color" 
                        bind:value={borderColor} 
                        class="custom-color-input-hidden" 
                        id="custom-border-trigger"
                        data-testid="input-custom-border"
                      />
                      <label for="custom-border-trigger" class="color-swatch custom-trigger" data-testid="btn-custom-border">
                        <Palette size={14} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <div class="footer-inner" data-testid="modal-footer-inner">
      <div class="shortcuts-hint">
        <kbd>Ctrl</kbd> + <kbd>Enter</kbd> — {t.common.save}
      </div>
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

  .header-icon-bg {
    width: 32px;
    height: 32px;
    background: color-mix(in srgb, var(--color-accent-violet) 15%, transparent);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
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

  .modal-content-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 4px;
  }

  .modal-sections-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
  }

  @media (min-width: 950px) {
    .modal-sections-grid {
      grid-template-columns: 1fr 1fr 1.2fr;
    }
  }

  .grid-column {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .preview-container {
    display: flex;
    justify-content: center;
    padding: 12px 16px;
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .preview-container::-webkit-scrollbar { width: 4px; }
  .preview-container::-webkit-scrollbar-track { background: transparent; }
  .preview-container::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }

  .preview-wrapper {
    width: 100%;
    max-width: 300px;
    pointer-events: none;
    opacity: 0.95;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 32px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-accent-violet);
    opacity: 0.9;
    padding-bottom: 6px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
  }

  .section-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .compact-identity {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 8px;
  }

  .identity-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    min-height: 40px;
  }

  .identity-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .identity-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .action-square-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    border-radius: 10px;
    border: 2px dashed var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    position: relative;
  }

  .action-square-btn:hover {
    border-color: var(--color-accent-violet);
    color: var(--color-accent-violet);
    background: color-mix(in srgb, var(--color-accent-violet) 5%, transparent);
  }

  .action-square-btn.active {
    border-style: solid;
    border-color: var(--color-accent-violet);
    background: color-mix(in srgb, var(--color-accent-violet) 10%, transparent);
    color: var(--color-accent-violet);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-violet) 15%, transparent);
  }

  .hotkey-text-compact {
    font-size: 0.95rem;
    font-weight: 800;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .delete-slot {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-action-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: #ff5555;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .delete-action-btn:hover {
    background: var(--color-danger);
    color: white;
    transform: scale(1.1);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  label, .form-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text-primary);
    opacity: 0.9;
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
    gap: 8px;
    padding: 8px 0;
  }

  .color-swatch {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.05);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .color-swatch:hover { transform: scale(1.1); z-index: 2; }
  :global(.check-icon) { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); pointer-events: none; }

  .custom-color-swatch-wrapper { position: relative; }
  .custom-trigger { background: var(--color-surface-2); border: 1px dashed var(--color-border); color: var(--color-text-muted); }
  .custom-color-input-hidden { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }

  .inner-swatch { width: 14px; height: 14px; border-radius: 3px; opacity: 0.6; }

  .footer-inner { display: flex; align-items: center; justify-content: space-between; width: 100%; }
  .shortcuts-hint { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-mono); }
  .shortcuts-hint kbd { background: var(--color-surface-3); border: 1px solid var(--color-border); padding: 2px 6px; border-radius: 4px; color: var(--color-text-secondary); }

  .btn-primary {
    padding: 10px 28px;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--color-accent-violet);
    color: white;
    border: none;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-violet) 25%, transparent);
  }

  .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); }

  .confirm-input {
    width: 60px;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    font-weight: 700;
  }
  .hint { font-size: 0.75rem; color: var(--color-text-muted); }
</style>