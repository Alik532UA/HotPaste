<script lang="ts">
  import {
    Settings,
    X,
    Layout,
    Keyboard,
    Maximize2,
    Minimize2,
    Trash2,
    Palette,
    Power,
    Zap,
    Type,
  } from "lucide-svelte";
  import { uiState } from "../stores/uiState.svelte";
  import { configState } from "../stores/configState.svelte";
  import { openHotkeyPicker } from "../stores/appState.svelte";
  import { theme } from "../states/theme.svelte";
  import { dataService } from "../services/dataService";
  import { t } from "../i18n";
  import BaseModal from "./ui/BaseModal.svelte";
  import SegmentedToggle from "./ui/SegmentedToggle.svelte";

  let isOpen = $state(false);
  let isClearing = $state(false);

  export function open() {
    isOpen = true;
  }

  export function close() {
    isOpen = false;
  }

  const modeOptions = [
    { id: "full", label: t.app.viewFull, icon: Maximize2 },
    { id: "minimal", label: t.app.viewMinimal, icon: Minimize2 },
  ];

  const themeSelectionOptions = [
    { id: "dark-gray", label: t.settings.themeDarkGray },
    { id: "light-gray", label: t.settings.themeLightGray },
    { id: "orange", label: t.settings.themeOrange },
    { id: "green", label: t.settings.themeGreen },
  ];

  const fontOptions = [
    { id: "Inter", label: "Inter" },
    { id: "e-Ukraine", label: "e-Ukraine" },
    { id: "KyivType Sans Local", label: "KyivType" },
    { id: "Arsenal", label: "Arsenal" },
    { id: "Namu Pro", label: "Namu" },
  ];

  const fontMonoOptions = [
    { id: "IBM Plex Mono", label: "IBM Plex (Global)" },
    { id: "Fira Code", label: "Fira Code (UA)" },
    { id: "Cascadia Mono", label: "Cascadia (MS)" },
  ];

  async function handleClearAllData() {
    if (isClearing) return;
    
    if (confirm(t.settings.clearCacheConfirm)) {
      isClearing = true;
      try {
        await dataService.clearAllData();
        window.location.reload();
      } catch (e) {
        console.error("Failed to clear data", e);
        isClearing = false;
      }
    }
  }

  function handleOpenHotkeyPicker() {
    openHotkeyPicker(null as any, (code) => {
      if (code) {
        configState.setTriggerKey(code);
      }
    });
  }
</script>

<BaseModal {isOpen} onClose={close} title={t.common.settings}>
  <div class="settings-content">
    <!-- Theme Selection -->
    <section class="settings-section">
      <h3 class="section-title">
        <Palette size={18} />
        {t.common.settings} — {t.tabs.color || "Тема"}
      </h3>
      <p class="section-desc">
        {t.settings.modeToggleDesc.replace(
          /.*/,
          "Виберіть колірну схему інтерфейсу",
        )}
      </p>

      <div class="setting-row">
        <SegmentedToggle
          id="theme-selection"
          options={themeSelectionOptions}
          value={theme.current}
          onSelect={(id) => theme.set(id as any)}
        />
      </div>
    </section>

    <div class="divider"></div>

    <!-- Typography -->
    <section class="settings-section">
      <h3 class="section-title">
        <Type size={18} />
        {t.settings?.typography || "Типографія"}
      </h3>
      
      <div class="font-settings-stack">
        <div class="font-setting-block">
          <p class="section-desc">Шрифт інтерфейсу</p>
          <div class="setting-row full-width">
            <SegmentedToggle
              id="font-family"
              options={fontOptions}
              value={configState.config.fontFamily}
              onSelect={(id) => configState.setFontFamily(id)}
            />
          </div>
        </div>

        <div class="font-setting-block">
          <p class="section-desc">Шрифт сніпетів (Mono)</p>
          <div class="setting-row full-width">
            <SegmentedToggle
              id="font-mono"
              options={fontMonoOptions}
              value={configState.config.fontMono}
              onSelect={(id) => configState.setFontMono(id)}
            />
          </div>
        </div>
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section">
      <h3 class="section-title">
        <Layout size={18} />
        {t.tabs.typeSnippets}
      </h3>
      <p class="section-desc">
        Режим відображення за замовчуванням при відкритті вкладок з нотатками
      </p>

      <div class="setting-row">
        <SegmentedToggle
          id="default-mode-snippets"
          options={modeOptions}
          value={configState.config.defaultModeSnippets}
          onSelect={(id) => configState.setDefaultModeSnippets(id as any)}
        />
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section">
      <h3 class="section-title">
        <Keyboard size={18} />
        {t.tabs.typeKeyboard}
      </h3>
      <p class="section-desc">
        Режим відображення за замовчуванням при відкритті вкладок з клавіатурою
      </p>

      <div class="setting-row">
        <SegmentedToggle
          id="default-mode-keyboard"
          options={modeOptions}
          value={configState.config.defaultModeKeyboard}
          onSelect={(id) => configState.setDefaultModeKeyboard(id as any)}
        />
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section">
      <h3 class="section-title">
        <Power size={18} />
        {t.settings.autostart}
      </h3>
      <p class="section-desc">{t.settings.autostartDesc}</p>

      <div class="setting-row">
        <SegmentedToggle
          id="autostart-toggle"
          options={[
            { id: "true", label: t.common.default || "Увімкнено" },
            { id: "false", label: t.common.disable || "Вимкнено" },
          ]}
          value={configState.config.autostartEnabled.toString()}
          onSelect={(id) => configState.setAutostartEnabled(id === "true")}
        />
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section">
      <h3 class="section-title">
        <Zap size={18} />
        {t.settings.globalHotkey}
      </h3>
      <p class="section-desc">{t.settings.globalHotkeyDesc}</p>

      <div class="setting-row hotkey-row">
        <SegmentedToggle
          id="global-hotkey-preset"
          options={[
            { id: "Win", label: t.settings.globalHotkeyWin },
            { id: "Alt+Space", label: t.settings.globalHotkeyAltSpace },
            { id: "custom", label: t.settings.globalHotkeyCustom },
          ]}
          value={["Win", "Alt+Space"].includes(configState.config.triggerKey) ? configState.config.triggerKey : "custom"}
          onSelect={(id) => {
            if (id !== "custom") {
              configState.setTriggerKey(id);
            } else {
              handleOpenHotkeyPicker();
            }
          }}
        />
        
        {#if !["Win", "Alt+Space"].includes(configState.config.triggerKey)}
          <button class="custom-hotkey-btn" onclick={handleOpenHotkeyPicker}>
            {configState.config.triggerKey}
          </button>
        {/if}
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section">
      <h3 class="section-title">
        <Maximize2 size={18} />
        {t.settings.modeToggle}
      </h3>
      <p class="section-desc">{t.settings.modeToggleDesc}</p>

      <div class="setting-row">
        <SegmentedToggle
          id="mode-toggle-hotkey"
          options={[
            { id: "space", label: t.settings.modeToggleOnlySpace },
            { id: "space_f11", label: t.settings.modeToggleSpace },
            { id: "f11", label: t.settings.modeToggleOnlyF11 },
          ]}
          value={configState.config.toggleModeHotkey}
          onSelect={(id) => configState.setToggleModeHotkey(id as any)}
        />
      </div>
    </section>

    <div class="divider"></div>

    <section class="settings-section">
      <h3 class="section-title danger">
        <Trash2 size={18} />
        {t.settings.clearCache}
      </h3>
      <p class="section-desc">{t.settings.clearCacheDesc}</p>

      <div class="setting-row">
        <button
          class="danger-btn"
          onclick={handleClearAllData}
          disabled={isClearing}
          data-testid="btn-clear-cache"
        >
          {isClearing ? t.common.loading : t.settings.clearCacheBtn}
        </button>
      </div>
    </section>
  </div>

  {#snippet footer()}
    <div class="footer-content">
      <span class="version-tag">v{__APP_VERSION__}</span>
      <button
        class="primary-btn"
        onclick={close}
        data-testid="btn-save-settings"
      >
        {t.common.save}
      </button>
    </div>
  {/snippet}
</BaseModal>

<style>
  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .version-tag {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-muted);
    opacity: 0.6;
    letter-spacing: 0.02em;
    font-family: var(--font-mono);
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-2) 0;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .section-title.danger {
    color: var(--color-danger);
  }

  .section-desc {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin: 0;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-top: var(--space-2);
  }

  .divider {
    height: 1px;
    background: var(--color-border);
    opacity: 0.5;
  }

  .primary-btn {
    background: var(--color-accent);
    color: var(--color-bg-primary);
    border: none;
    padding: 12px 28px;
    border-radius: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--color-accent) 25%, transparent);
  }

  .primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px
      color-mix(in srgb, var(--color-accent) 40%, transparent);
    filter: brightness(1.1);
  }

  .danger-btn {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger);
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    padding: 10px 20px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .danger-btn:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--color-danger) 30%, transparent);
  }

  .hotkey-row {
    gap: var(--space-3);
  }

  .custom-hotkey-btn {
    background: var(--color-bg-secondary);
    color: var(--color-accent);
    border: 1px solid var(--color-border);
    padding: 8px 16px;
    border-radius: 10px;
    font-weight: 700;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.2s;
  }

  .custom-hotkey-btn:hover {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  }

  .font-settings-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-top: var(--space-2);
  }

  .font-setting-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .setting-row.full-width {
    width: 100%;
  }

  .setting-row.full-width :global(.segmented-toggle) {
    width: 100%;
    display: flex;
  }

  .setting-row.full-width :global(.segmented-toggle button) {
    flex: 1;
  }
</style>
