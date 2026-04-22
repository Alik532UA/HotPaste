<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import {
    getState,
    handleGlobalKeydown,
    connectDirectory,
    adjustScale,
    setScale,
    refreshTabs,
    setCardView,
    setCardDensity,
  } from "./lib/stores/appState.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import CardGrid from "./lib/components/CardGrid.svelte";
  import StartMenu from "./lib/components/StartMenu.svelte";
  import Toast from "./lib/components/Toast.svelte";
  import EmptyState from "./lib/components/EmptyState.svelte";
  import FAB from "./lib/components/FAB.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
  import CardSettingsModal from "./lib/components/CardSettingsModal.svelte";
  import TabSettingsModal from "./lib/components/TabSettingsModal.svelte";
  import HotkeyConflictModal from "./lib/components/HotkeyConflictModal.svelte";
  import HotkeyPickerModal from "./lib/components/HotkeyPickerModal.svelte";
  import ProgramPickerModal from "./lib/components/ProgramPickerModal.svelte";
  import IconPickerModal from "./lib/components/IconPickerModal.svelte";
  import GlobalSettingsModal from "./lib/components/GlobalSettingsModal.svelte";
  import DebugListener from "./lib/components/DebugListener.svelte";
  import DynamicBackground from "./lib/components/DynamicBackground.svelte";
  import SegmentedToggle from "./lib/components/ui/SegmentedToggle.svelte";
  import BatchActionBar from "./lib/components/ui/BatchActionBar.svelte";
  import GlobalErrorFallback from "./lib/components/ui/GlobalErrorFallback.svelte";
  import { theme } from "./lib/states/ThemeState.svelte";
  import { background } from "./lib/states/BackgroundState.svelte";
  import { adaptiveHeader } from "./lib/states/AdaptiveHeader.svelte";
  import { language } from "./lib/i18n/language.svelte";
  import {
    initUrlSync,
    restoreTabFromUrl,
  } from "./lib/services/urlSync.svelte";
  import { t } from "./lib/i18n";
  import { logService } from "./lib/services/logService.svelte";
  import { uiState } from "./lib/stores/uiState.svelte";
  import { configState } from "./lib/stores/configState.svelte";
  import { fsState } from "./lib/stores/fileSystemState.svelte";
  import { checkForUpdates } from "./lib/services/versionService";
  import UpdateModal from "./lib/components/ui/UpdateModal.svelte";
  import ActionConfirmationModal from "./lib/components/ui/ActionConfirmationModal.svelte";
  import LogCopyButton from "./lib/components/ui/LogCopyButton.svelte";
  import {
    Sparkles,
    Waves,
    Shapes,
    Moon,
    Sun,
    Settings,
    Zap,
    FolderOpen,
    MousePointer2,
    Citrus,
    Leaf,
    Ban,
  } from "lucide-svelte";

  const appState = getState();

  let globalSettingsModal = $state<ReturnType<typeof GlobalSettingsModal>>();
  let headerContentRef = $state<HTMLElement | null>(null);
  let headerLeftRef = $state<HTMLElement | null>(null);
  let headerRightRef = $state<HTMLElement | null>(null);
  let headerWidth = $state(0);

  // Sync collapsed state from controller
  const collapsed = $derived(adaptiveHeader.collapsed);

  // Force update when width changes (reactive trigger)
  $effect(() => {
    if (headerWidth) {
      adaptiveHeader.update();
    }
  });

  // Determine if running in Tauri environment
  const isTauri = !!(
    typeof window !== "undefined" &&
    ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)
  );

  /** Scale dragging logic */
  let isDraggingScale = $state(false);
  let startDragX = $state(0);
  let startScale = $state(1.0);

  async function handleRefreshTabs() {
    await refreshTabs();
    restoreTabFromUrl();
  }

  function handleScaleMouseDown(e: MouseEvent) {
    isDraggingScale = true;
    startDragX = e.clientX;
    startScale = appState.scale;
    document.body.style.cursor = "col-resize";
    e.preventDefault();

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingScale) return;
      const deltaX = moveEvent.clientX - startDragX;
      const scaleDelta = deltaX / 500;
      setScale(startScale + scaleDelta);
    };

    const onMouseUp = () => {
      isDraggingScale = false;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleScaleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setScale(1.0);
    }
  }

  function onKeydown(e: KeyboardEvent) {
    handleGlobalKeydown(e);
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      adjustScale(delta);
    }
  }

  // Effect to handle minimal mode transitions
  $effect(() => {
    // Helper to build font stack string
    const buildStack = (primary: string, fallbacks: string[]) => {
      const stack = [primary, ...fallbacks].filter((v, i, a) => a.indexOf(v) === i);
      return stack.map(f => `'${f}'`).join(', ');
    };

    // Dynamically update fonts from config
    const ff = buildStack(configState.config.fontFamily, ['Inter', 'system-ui', 'sans-serif']);
    const fm_md = buildStack(configState.config.fontMd, ['Arsenal', 'Inter', 'system-ui', 'sans-serif']);
    const fm_txt = buildStack(configState.config.fontTxt, ['IBM Plex Mono', 'Cascadia Mono', 'Source Code Pro', 'monospace']);
    const fm_hk = buildStack(configState.config.fontHotkey, ['Fira Code', 'Cascadia Mono', 'Source Code Pro', 'monospace']);

    document.documentElement.style.setProperty('--font-family', ff);
    document.documentElement.style.setProperty('--font-md', fm_md);
    document.documentElement.style.setProperty('--font-txt', fm_txt);
    document.documentElement.style.setProperty('--font-hotkey', fm_hk);

    if (uiState.isMinimalMode) {
      document.documentElement.classList.add("is-minimal");
    } else {
      document.documentElement.classList.remove("is-minimal");
      adaptiveHeader.update();
    }

    if (isTauri) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("set_minimal_mode_tauri", {
          minimal: uiState.isMinimalMode,
        }).catch((err) =>
          logService.error("app", "Failed to sync minimal mode to Tauri", err),
        );
      });
    }
  });

  // Effect to force header update when critical content changes
  $effect(() => {
    // These values change the header content width
    const _contentTriggers = [fsState.rootName, language.current, t.app.title];
    adaptiveHeader.update();
  });

  onMount(() => {
    if (isTauri) {
      document.documentElement.classList.add("is-tauri");

      // Clear any pending confirmation when window is hidden
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().listen("tauri://window-visibility-changed", (event: any) => {
          if (event.payload?.visible === false) {
            uiState.closeActionConfirmation();
          }
        });
      });

      // Sync trigger key on startup
      if (configState.config.triggerKey !== "Win") {
        configState.setTriggerKey(configState.config.triggerKey);
      }

      // Initial autostart sync
      if (import.meta.env.DEV) {
        // Force disable autostart in dev version as per requirements
        configState.setAutostartEnabled(false);
      } else {
        configState.setAutostartEnabled(configState.config.autostartEnabled);
      }
    }

    background.init();
    initUrlSync();
    
    // Check for updates on startup
    checkForUpdates();
  });

  // Adaptive header init — $effect reacts to header DOM appearing/disappearing.
  // Root cause fix: onMount ran when isConnected=false (header not in DOM yet),
  // so adaptiveHeader.init() was never called. $effect re-runs when refs change.
  // untrack() prevents tracking logService/$state dependencies inside init().
  $effect(() => {
    const container = headerContentRef;
    const left = headerLeftRef;
    const right = headerRightRef;
    if (container && left && right) {
      return untrack(() => {
        logService.info('header', 'Header refs available, initializing adaptive header');
        return adaptiveHeader.init(container, left, right);
      });
    }
  });
</script>

<svelte:window onkeydown={onKeydown} onwheel={onWheel} />

{#if !fsState.isConnected}
  <EmptyState onConnect={connectDirectory} />
{:else}
  <div class="app-shell" class:minimal={uiState.isMinimalMode}>
    <!-- App Header -->
    {#if !uiState.isMinimalMode}
      <header class="app-header">
        <div
          class="header-content"
          bind:this={headerContentRef}
          bind:clientWidth={headerWidth}
        >
          <!-- Left Side: Logo & Info -->
          <div class="header-left" bind:this={headerLeftRef}>
            <h1 class="app-logo">
              <span class="logo-icon"><Zap size={20} /></span>
              {t.app.title}
            </h1>
            <div class="header-divider"></div>
            <span class="root-name" title={fsState.rootName}>
              <FolderOpen size={16} />
              {fsState.rootName}
            </span>
          </div>

          <!-- Right Side: Controls -->
          <div
            class="header-right"
            bind:this={headerRightRef}
            data-testid="header-right"
          >
            <SegmentedToggle
              id="view"
              options={[
                { id: "short", label: t.app.viewShort },
                { id: "full", label: t.app.viewFull },
              ]}
              value={uiState.cardView}
              onSelect={(id) => setCardView(id as any)}
              isCompact={collapsed["view"]}
            />

            <SegmentedToggle
              id="density"
              options={[
                { id: "compact", label: t.app.densityCompact },
                { id: "normal", label: t.app.densityNormal },
                { id: "expanded", label: t.app.densityExpanded },
              ]}
              value={uiState.cardDensity}
              onSelect={(id) => setCardDensity(id as any)}
              isCompact={collapsed["density"]}
            />

            <SegmentedToggle
              id="theme"
              options={[
                { id: "dark-gray", icon: Moon, label: "Dark" },
                { id: "light-gray", icon: Sun, label: "Light" },
                { id: "orange", icon: Citrus, label: "Orange" },
                { id: "green", icon: Leaf, label: "Green" },
              ]}
              value={theme.current}
              onSelect={(id) => theme.set(id as any)}
              isCompact={collapsed["theme"]}
            />

            <SegmentedToggle
              id="lang"
              options={[
                { id: "uk", label: "UA" },
                { id: "en", label: "EN" },
              ]}
              value={language.current}
              onSelect={(id) => language.set(id as any)}
              isCompact={collapsed["lang"]}
            />

            <SegmentedToggle
              id="bg-type"
              options={[
                { id: "none", icon: Ban, label: "None" },
                { id: "particles", icon: Sparkles, label: "Particles" },
                { id: "waves", icon: Waves, label: "Waves" },
                { id: "floating_shapes", icon: Shapes, label: "Shapes" },
              ]}
              value={background.current}
              onSelect={(id) => background.set(id as any)}
              isCompact={collapsed["bg-type"]}
            />

            <div class="header-divider"></div>

            <!-- Scale Control -->
            <div class="scale-control">
              <button
                class="scale-btn"
                onclick={() => adjustScale(-0.1)}
                title="Зменшити"
                data-testid="btn-scale-decrease">−</button
              >
              <span
                class="scale-value"
                class:dragging={isDraggingScale}
                onmousedown={handleScaleMouseDown}
                onkeydown={handleScaleKeydown}
                role="button"
                tabindex="0"
                title="Тягніть для зміни"
                data-testid="scale-value"
              >
                {Math.round(appState.scale * 100)}%
              </span>
              <button
                class="scale-btn"
                onclick={() => adjustScale(0.1)}
                title="Збільшити"
                data-testid="btn-scale-increase">+</button
              >
            </div>

            <div class="header-actions">
              <button
                class="icon-btn"
                onclick={handleRefreshTabs}
                title={t.app.refresh}
                data-testid="btn-refresh-tabs"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M14.5 3.5A7 7 0 1 0 16 9"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                  <path
                    d="M14.5 1v3h-3"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <button
                class="icon-btn"
                onclick={connectDirectory}
                title={t.app.changeDir}
                data-testid="btn-change-directory"
              >
                <FolderOpen size={18} />
              </button>
              <button
                class="icon-btn"
                onclick={() => globalSettingsModal?.open()}
                title={t.common.settings}
                data-testid="btn-global-settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Tabs Bar -->
      <div class="tab-bar-wrapper">
        <TabBar />
      </div>
    {/if}

    <!-- Main View Area -->
    <main
      class="app-main"
      class:no-scroll={appState.activeTab?.type === "keyboard"}
    >
      <GlobalErrorFallback>
        {#if appState.activeTab?.type === "keyboard"}
          <StartMenu />
        {:else}
          <div class="drag-layer"></div>
          <CardGrid />
        {/if}
      </GlobalErrorFallback>
    </main>

    {#if !uiState.isMinimalMode && appState.activeTab?.type !== "keyboard"}
      <FAB />
    {/if}

    <Toast />
    <BatchActionBar />
  </div>
{/if}

<!-- Modals & Overlays -->
<CardSettingsModal />
<TabSettingsModal />
<HotkeyConflictModal />
<HotkeyPickerModal />
<ProgramPickerModal />
<IconPickerModal />
<ActionConfirmationModal />
<GlobalSettingsModal bind:this={globalSettingsModal} />
<DebugListener />
<UpdateModal />

{#if uiState.activeContextMenu}
  <ContextMenu />
{/if}

<DynamicBackground />
<LogCopyButton />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: transparent;
    color: var(--color-text-primary);
    position: relative;
  }

  .app-header {
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
    padding: 0 20px;
    height: 64px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    position: relative;
    z-index: 100;
  }

  .header-content {
    display: flex;
    justify-content: flex-end; /* Right priority */
    align-items: center;
    width: 100%;
    max-width: 100%;
    gap: 24px;
    /* overflow: hidden; -- removed to allow dropdowns */
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-right: auto; /* Push everything else to the right */
    min-width: 0;
    overflow: hidden; /* Needed for scrollWidth measurement */
  }

  .app-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.25rem;
    font-weight: 800;
    background: var(--color-accent-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    white-space: nowrap;
    flex-shrink: 1; /* Allow shrinking */
  }

  .header-divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  .root-name {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    flex: 1;
    min-width: 0; /* This is the key for truncation */
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0; /* Right side NEVER cuts off */
    /* overflow: hidden; -- removed to allow dropdowns */
  }

  .tab-bar-wrapper {
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }

  .scale-control {
    display: flex;
    align-items: center;
    background: var(--color-surface-2);
    border-radius: 10px;
    border: 1px solid var(--color-border);
    padding: 2px;
    height: 36px;
  }

  .scale-btn {
    width: 28px;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 6px;
  }

  .scale-btn:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .scale-value {
    min-width: 44px;
    text-align: center;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    cursor: col-resize;
    user-select: none;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    padding-left: 8px;
    border-left: 1px solid var(--color-border);
  }

  .icon-btn {
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }

  .app-main {
    flex: 1;
    overflow-y: auto;
    background-color: transparent;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .app-main.no-scroll {
    overflow: hidden;
  }

  .drag-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
  }
</style>
