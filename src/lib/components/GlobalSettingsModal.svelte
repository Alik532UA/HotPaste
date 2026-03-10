<script lang="ts">
  import { Settings, X, Layout, Keyboard, Maximize2, Minimize2, Trash2 } from "lucide-svelte";
  import { uiState } from "../stores/uiState.svelte";
  import { configState } from "../stores/configState.svelte";
  import { dataService } from "../services/dataService";
  import { t } from "../i18n";
  import BaseModal from "./ui/BaseModal.svelte";
  import SegmentedToggle from "./ui/SegmentedToggle.svelte";

  let isOpen = $state(false);

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

  async function clearAllData() {
    await dataService.clearAllData();
  }
</script>

<BaseModal {isOpen} onclose={close} title={t.common.settings} icon={Settings}>
  <div class="settings-content">
    <section class="settings-section">
      <h3 class="section-title">
        <Layout size={18} />
        {t.tabs.typeSnippets}
      </h3>
      <p class="section-desc">Режим відображення за замовчуванням при відкритті вкладок з нотатками</p>
      
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
      <p class="section-desc">Режим відображення за замовчуванням при відкритті вкладок з клавіатурою</p>
      
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
      <h3 class="section-title danger">
        <Trash2 size={18} />
        {t.settings.clearCache}
      </h3>
      <p class="section-desc">{t.settings.clearCacheDesc}</p>
      
      <div class="setting-row">
        <button class="danger-btn" onclick={clearAllData}>
          {t.settings.clearCacheBtn}
        </button>
      </div>
    </section>
  </div>

  {#snippet footer()}
    <button class="primary-btn" onclick={close}>
      {t.common.save}
    </button>
  {/snippet}
</BaseModal>

<style>
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
    background: var(--color-accent-violet);
    color: white;
    border: none;
    padding: var(--space-2) var(--space-6);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .danger-btn {
    background: transparent;
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .danger-btn:hover {
    background: var(--color-danger);
    color: white;
  }
</style>
