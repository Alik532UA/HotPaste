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
  import { logService } from "../services/logService.svelte";
  import { theme } from "../states/theme.svelte";
  import { dataService } from "../services/dataService";
  import { t } from "../i18n";
  import { fade } from "svelte/transition";
  import BaseModal from "./ui/BaseModal.svelte";
  import SegmentedToggle from "./ui/SegmentedToggle.svelte";
  
  // Import SVG icons as raw strings
  import uaIcon from "../../assets/icons/origin/ua.svg?raw";
  import msIcon from "../../assets/icons/origin/ms.svg?raw";
  import sweIcon from "../../assets/icons/origin/swe.svg?raw";
  import usaIcon from "../../assets/icons/origin/usa.svg?raw";

  const ICONS = {
    UA: uaIcon,
    MS: msIcon,
    SWE: sweIcon,
    USA: usaIcon,
  };

  let isOpen = $state(false);
  let isClearing = $state(false);
  let activeTab = $state("appearance");

  export function open() {
    isOpen = true;
  }

  export function close() {
    isOpen = false;
  }

  const settingsTabs = [
    { id: "appearance", label: "Вигляд", icon: Layout },
    { id: "typography", label: "Шрифти", icon: Type },
    { id: "system", label: "Система", icon: Settings },
  ];

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

  const allFontOptions = [
    { id: "Inter", label: "Inter", fontFamily: "Inter", originIcon: ICONS.SWE },
    { id: "e-Ukraine", label: "e-Ukraine", fontFamily: "e-Ukraine", originIcon: ICONS.UA },
    { id: "KyivType Sans Local", label: "KyivType", fontFamily: "KyivType Sans Local", originIcon: ICONS.UA },
    { id: "Arsenal", label: "Arsenal", fontFamily: "Arsenal", originIcon: ICONS.UA },
    { id: "Namu Pro", label: "Namu", fontFamily: "Namu Pro", originIcon: ICONS.UA },
    { id: "IBM Plex Mono", label: "IBM Plex", fontFamily: "IBM Plex Mono", originIcon: ICONS.USA },
    { id: "Fira Code", label: "Fira Code", fontFamily: "Fira Code", originIcon: ICONS.UA },
    { id: "Cascadia Mono", label: "Cascadia", fontFamily: "Cascadia Mono", originIcon: ICONS.MS },
    { id: "Source Code Pro", label: "Source Code", fontFamily: "Source Code Pro", originIcon: ICONS.USA },
  ];

  async function handleClearAllData() {
    if (isClearing) return;
    
    if (confirm(t.settings.clearCacheConfirm)) {
      isClearing = true;
      try {
        await dataService.clearAllData();
        window.location.reload();
      } catch (e) {
        logService.error('GlobalSettings', `Failed to clear data: ${e}`);
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
    <!-- Tab Navigation -->
    <div class="settings-tabs">
      <SegmentedToggle
        id="settings-tabs"
        options={settingsTabs}
        value={activeTab}
        onSelect={(id) => (activeTab = id)}
      />
    </div>

    {#if activeTab === "appearance"}
      <div class="tab-pane" in:fade={{ duration: 200 }}>
        <!-- Theme Selection -->
        <section class="settings-section">
          <h3 class="section-title">
            <Palette size={18} />
            {t.common.settings} — {t.tabs.color || "Тема"}
          </h3>
          <p class="section-desc">
            Виберіть колірну схему інтерфейсу
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
      </div>
    {:else if activeTab === "typography"}
      <div class="tab-pane" in:fade={{ duration: 200 }}>
        <!-- Typography -->
        <section class="settings-section">
          <h3 class="section-title">
            <Type size={18} />
            {t.settings?.typography || "Типографія"}
          </h3>

          <!-- Font Preview Box -->
          <div class="font-preview-box">
            <div class="preview-ui" style="font-family: {configState.config.fontFamily}">
              <span class="preview-label">UI</span>
              <div class="preview-content">HotPaste — швидкий доступ до сніпетів</div>
            </div>

            <div class="preview-grid">
              <div class="preview-item md" style="font-family: {configState.config.fontMd}">
                <span class="preview-label">MD</span>
                <div class="preview-content">
                  <h4>Заголовок</h4>
                  <p>Опис промта...</p>
                </div>
              </div>

              <div class="preview-item txt" style="font-family: {configState.config.fontTxt}">
                <span class="preview-label">TXT</span>
                <div class="preview-content">
                  <code>git commit -m "feat: fonts"</code>
                </div>
              </div>
            </div>

            <div class="preview-footer">
              <div class="preview-hotkey">
                <span class="preview-label">Key</span>
                <div class="hotkey-example" style="font-family: {configState.config.fontHotkey}">A</div>
              </div>
              <p class="preview-hint">Так виглядатиме ваш інтерфейс</p>
            </div>
          </div>          
          <div class="font-settings-stack">
            <!-- Interface Font -->
            <div class="font-setting-block">
              <p class="section-desc">Шрифт інтерфейсу</p>
              <div class="setting-row full-width">
                <SegmentedToggle
                  id="font-family"
                  options={allFontOptions}
                  value={configState.config.fontFamily}
                  onSelect={(id) => configState.setFontFamily(id)}
                />
              </div>
            </div>

            <!-- MD Font -->
            <div class="font-setting-block">
              <p class="section-desc">Шрифт сніпетів .md</p>
              <div class="setting-row full-width">
                <SegmentedToggle
                  id="font-md"
                  options={allFontOptions}
                  value={configState.config.fontMd}
                  onSelect={(id) => configState.setFontMd(id)}
                />
              </div>
            </div>

            <!-- TXT Font -->
            <div class="font-setting-block">
              <p class="section-desc">Шрифт сніпетів .txt</p>
              <div class="setting-row full-width">
                <SegmentedToggle
                  id="font-txt"
                  options={allFontOptions}
                  value={configState.config.fontTxt}
                  onSelect={(id) => configState.setFontTxt(id)}
                />
              </div>
            </div>

            <!-- Hotkey Font -->
            <div class="font-setting-block">
              <p class="section-desc">Шрифт кнопок та клавіш</p>
              <div class="setting-row full-width">
                <SegmentedToggle
                  id="font-hotkey"
                  options={allFontOptions}
                  value={configState.config.fontHotkey}
                  onSelect={(id) => configState.setFontHotkey(id)}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    {:else if activeTab === "system"}
      <div class="tab-pane" in:fade={{ duration: 200 }}>
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
    {/if}
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

  .settings-tabs {
    margin-bottom: var(--space-2);
  }

  .settings-tabs :global(.segmented-wrapper) {
    width: 100%;
  }

  .settings-tabs :global(.segmented-control) {
    width: 100%;
    display: flex;
  }

  .settings-tabs :global(.segmented-control button) {
    flex: 1;
    font-size: 0.85rem;
    height: 40px;
  }

  .tab-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
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

  .setting-row.full-width :global(.segmented-wrapper) {
    width: 100%;
  }

  .setting-row.full-width :global(.segmented-toggle) {
    width: 100%;
    display: flex;
  }

  .setting-row.full-width :global(.segmented-toggle button) {
    flex: 1;
  }

  /* Font Preview Styles */
  .font-preview-box {
    margin-top: var(--space-4);
    padding: var(--space-4);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .preview-label {
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--color-accent-cyan);
    margin-bottom: 2px;
    display: block;
    opacity: 0.7;
  }

  .preview-ui {
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-family);
  }

  .preview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .preview-item.md {
    font-family: var(--font-md);
  }

  .preview-item.md h4 {
    margin: 0;
    font-size: 0.9rem;
  }

  .preview-item.md p {
    margin: 0;
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .preview-item.txt {
    font-family: var(--font-txt);
  }

  .preview-item.txt code {
    font-size: 0.7rem;
    background: var(--color-surface-3);
    padding: 2px 4px;
    border-radius: 4px;
  }

  .preview-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
  }

  .hotkey-example {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-family: var(--font-hotkey);
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-accent-cyan);
  }

  .preview-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-style: italic;
    margin: 0;
  }
</style>
