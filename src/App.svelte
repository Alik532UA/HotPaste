<script lang="ts">
  import { onMount, tick } from "svelte";
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
  import { theme } from "./lib/states/theme.svelte";
  import { background } from "./lib/states/background.svelte";
  import { adaptiveHeader } from "./lib/states/adaptiveHeader.svelte";
  import { language } from "./lib/i18n/language.svelte";
  import {
    initUrlSync,
    restoreTabFromUrl,
  } from "./lib/services/urlSync.svelte";
  import { t } from "./lib/i18n";
  import { logService } from "./lib/services/logService.svelte";
  import { uiState } from "./lib/stores/uiState.svelte";
  import { fsState } from "./lib/stores/fileSystemState.svelte";
  import { checkForUpdates } from "./lib/services/versionService";
  import UpdateModal from "./lib/components/ui/UpdateModal.svelte";
  import { Sparkles, Waves, Shapes, Moon, Sun, Settings, Zap, FolderOpen, MousePointer2, Citrus, Leaf, Ban } from "lucide-svelte";

  const appState = getState();

  let globalSettingsModal = $state<ReturnType<typeof GlobalSettingsModal>>();
  let headerContentRef = $state<HTMLElement | null>(null);
  let headerLeftRef = $state<HTMLElement | null>(null);
  let headerRightRef = $state<HTMLElement | null>(null);

  // Sync collapsed state from controller
  const collapsed = $derived(adaptiveHeader.collapsed);

  // Determine if running in Tauri environment
  // @ts-ignore
  const isTauri = !!(typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__));

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
    if (uiState.isMinimalMode) {
      document.documentElement.classList.add("is-minimal");
    } else {
      document.documentElement.classList.remove("is-minimal");
      adaptiveHeader.update(true);
    }

    if (isTauri) {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("set_minimal_mode_tauri", { minimal: uiState.isMinimalMode })
          .catch(err => logService.error("app", "Failed to sync minimal mode to Tauri", err));
      });
    }
  });

  onMount(() => {
    if (isTauri) {
      document.documentElement.classList.add("is-tauri");
    }
    
    theme.init();
    language.init();
    background.init();
    initUrlSync();

    if (headerContentRef && headerLeftRef && headerRightRef) {
      return adaptiveHeader.init(headerContentRef, headerLeftRef, headerRightRef);
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
        <div class="header-content" bind:this={headerContentRef}>
          <!-- Left Side: Logo & Info -->
          <div class="header-left" bind:this={headerLeftRef}>
            <h1 class="app-logo">
              <span class="logo-icon"><Zap size={20} /></span>
              {t.app.title}
            </h1>
            <div class="header-divider"></div>
            <span class="root-name" title={fsState.rootName}>
              <FolderOpen size={16} /> {fsState.rootName}
            </span>
          </div>

          <!-- Right Side: Controls -->
          <div class="header-right" bind:this={headerRightRef} data-testid="header-right">
            <!-- Adaptive Groups -->
            <div class="adaptive-group" class:collapsed={collapsed.view}>
              <div class="group-full">
                <SegmentedToggle
                  id="view"
                  options={[
                    { id: "short", label: t.app.viewShort },
                    { id: "full", label: t.app.viewFull },
                  ]}
                  value={uiState.cardView}
                  onSelect={(id) => setCardView(id as any)}
                />
              </div>
              <div class="group-compact">
                <button class="compact-btn" onclick={() => uiState.toggleCardView()} title="Вигляд карток">
                  {#if uiState.cardView === 'short'}<Zap size={18} />{:else}<FolderOpen size={18} />{/if}
                </button>
              </div>
            </div>

            <div class="adaptive-group" class:collapsed={collapsed.density}>
              <div class="group-full">
                <SegmentedToggle
                  id="density"
                  options={[
                    { id: "compact", label: t.app.densityCompact },
                    { id: "normal", label: t.app.densityNormal },
                    { id: "expanded", label: t.app.densityExpanded },
                  ]}
                  value={uiState.cardDensity}
                  onSelect={(id) => setCardDensity(id as any)}
                />
              </div>
              <div class="group-compact">
                <button class="compact-btn" onclick={() => uiState.toggleCardDensity()} title="Щільність карток">
                  <MousePointer2 size={18} />
                </button>
              </div>
            </div>

            <div class="adaptive-group" class:collapsed={collapsed.theme}>
              <div class="group-full">
                <SegmentedToggle
                  id="theme"
                  options={[
                    { id: "dark-gray", icon: Moon, label: "" },
                    { id: "light-gray", icon: Sun, label: "" },
                    { id: "orange", icon: Citrus, label: "" },
                    { id: "green", icon: Leaf, label: "" },
                  ]}
                  value={theme.current}
                  onSelect={(id) => theme.set(id as any)}
                />
              </div>
              <div class="group-compact">
                <button class="compact-btn" onclick={() => theme.next()} title="Змінити тему">
                  {#if theme.current === 'dark-gray'}<Moon size={18} />
                  {:else if theme.current === 'light-gray'}<Sun size={18} />
                  {:else if theme.current === 'orange'}<Citrus size={18} />
                  {:else}<Leaf size={18} />{/if}
                </button>
              </div>
            </div>

            <div class="adaptive-group" class:collapsed={collapsed.language}>
              <div class="group-full">
                <SegmentedToggle
                  id="lang"
                  options={[
                    { id: "uk", label: "UA" },
                    { id: "en", label: "EN" },
                  ]}
                  value={language.current}
                  onSelect={(id) => language.set(id as any)}
                />
              </div>
              <div class="group-compact">
                <button class="compact-btn" onclick={() => language.toggle()} title="Змінити мову">
                  <span class="lang-code">{language.current.toUpperCase()}</span>
                </button>
              </div>
            </div>

            <div class="adaptive-group" class:collapsed={collapsed.background}>
              <div class="group-full">
                <SegmentedToggle
                  id="bg-type"
                  options={[
                    { id: "none", icon: Ban, label: "" },
                    { id: "particles", icon: Sparkles, label: "" },
                    { id: "waves", icon: Waves, label: "" },
                    { id: "floating_shapes", icon: Shapes, label: "" },
                  ]}
                  value={background.current}
                  onSelect={(id) => {
                    console.log('SegmentedToggle bg-type select:', id);
                    background.set(id as any);
                  }}
                />
              </div>
              <div class="group-compact">
                <button class="compact-btn" onclick={() => background.next()} title="Змінити фон">
                  <Sparkles size={18} />
                </button>
              </div>
            </div>

            <div class="header-divider"></div>

            <!-- Scale Control -->
            <div class="scale-control">
              <button class="scale-btn" onclick={() => adjustScale(-0.1)} title="Зменшити">−</button>
              <span 
                class="scale-value" 
                class:dragging={isDraggingScale} 
                onmousedown={handleScaleMouseDown}
                onkeydown={handleScaleKeydown}
                role="button"
                tabindex="0"
                title="Тягніть для зміни"
              >
                {Math.round(appState.scale * 100)}%
              </span>
              <button class="scale-btn" onclick={() => adjustScale(0.1)} title="Збільшити">+</button>
            </div>

            <div class="header-actions">
              <button class="icon-btn" onclick={handleRefreshTabs} title={t.app.refresh}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M14.5 3.5A7 7 0 1 0 16 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <path d="M14.5 1v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button class="icon-btn" onclick={connectDirectory} title={t.app.changeDir}>
                <FolderOpen size={18} />
              </button>
              <button 
                class="icon-btn" 
                onclick={() => globalSettingsModal?.open()}
                title={t.common.settings}
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
    <main class="app-main" class:no-scroll={appState.activeTab?.type === 'keyboard'}>
      <GlobalErrorFallback>
        {#if appState.activeTab?.type === 'keyboard'}
          <StartMenu />
        {:else}
          <div class="drag-layer"></div>
          <CardGrid />
        {/if}
      </GlobalErrorFallback>
    </main>

    {#if !uiState.isMinimalMode && appState.activeTab?.type !== 'keyboard'}
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
<GlobalSettingsModal bind:this={globalSettingsModal} />
<DebugListener />
<UpdateModal />

{#if uiState.activeContextMenu}
  <ContextMenu />
{/if}

<DynamicBackground />

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
    z-index: 100;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 100%;
    gap: 24px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
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
  }

  .logo-icon {
    -webkit-text-fill-color: initial;
    filter: drop-shadow(0 0 8px rgba(var(--color-accent-rgb), 0.5));
  }

  .header-divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
  }

  .root-name {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .tab-bar-wrapper {
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  /* Adaptive System Styles */
  .adaptive-group {
    position: relative;
  }

  .group-full {
    display: flex;
  }

  .group-compact {
    display: none;
  }

  .adaptive-group.collapsed .group-full {
    display: none;
  }

  .adaptive-group.collapsed .group-compact {
    display: flex;
  }

  .compact-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .compact-btn:hover {
    background: var(--color-surface-3);
    border-color: var(--color-accent-violet);
    color: var(--color-accent-violet);
  }

  .lang-code {
    font-size: 0.75rem;
    font-weight: 700;
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
