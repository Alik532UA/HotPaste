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
  import GlobalSettingsModal from "./lib/components/GlobalSettingsModal.svelte";
  import DebugListener from "./lib/components/DebugListener.svelte";
  import DynamicBackground from "./lib/components/DynamicBackground.svelte";
  import SegmentedToggle from "./lib/components/ui/SegmentedToggle.svelte";
  import BatchActionBar from "./lib/components/ui/BatchActionBar.svelte";
  import GlobalErrorFallback from "./lib/components/ui/GlobalErrorFallback.svelte";
  import { theme } from "./lib/states/theme.svelte";
  import { background } from "./lib/states/background.svelte";
  import { language } from "./lib/i18n/language.svelte";
  import {
    initUrlSync,
    restoreTabFromUrl,
  } from "./lib/services/urlSync.svelte";
  import { t } from "./lib/i18n";
  import { logService } from "./lib/services/logService.svelte";
  import { uiState } from "./lib/stores/uiState.svelte";
  import { fsState } from "./lib/stores/fileSystemState.svelte";
  import { Sparkles, Waves, Shapes, Moon, Sun, Settings, Zap, FolderOpen, MousePointer2, Citrus, Leaf } from "lucide-svelte";

  const appState = getState();

  let globalSettingsModal = $state<ReturnType<typeof GlobalSettingsModal>>();
  let headerContentRef = $state<HTMLElement | null>(null);
  let headerLeftRef = $state<HTMLElement | null>(null);
  let headerRightRef = $state<HTMLElement | null>(null);

  /** 
   * SMART ADAPTIVE SYSTEM - Refined for Stability
   */
  let collapsedStates = $state<Record<string, boolean>>({
    background: false,
    language: false,
    theme: false,
    density: false,
    view: false
  });

  const COLLAPSE_ORDER = ['background', 'language', 'theme', 'density', 'view'];
  let isUpdatingLayout = false;
  let lastWidth = 0;

  async function updateAdaptiveLayout() {
    if (!headerLeftRef || !headerRightRef || !headerContentRef || isUpdatingLayout || uiState.isMinimalMode) return;
    
    const containerWidth = headerContentRef.getBoundingClientRect().width;
    if (containerWidth === 0) return;

    if (Math.abs(containerWidth - lastWidth) < 5) return;
    
    const isExpanding = containerWidth > lastWidth;
    lastWidth = containerWidth;
    
    isUpdatingLayout = true;

    if (isExpanding) {
      for (const key of COLLAPSE_ORDER) {
        collapsedStates[key] = false;
      }
      await tick();
      await new Promise(r => requestAnimationFrame(r));
    }

    // Sequentially collapse until they FIT
    const MIN_GAP = 24;

    for (const key of COLLAPSE_ORDER) {
      // scrollWidth gives us the "ideal" width even if the element is shrunk by flex
      const leftDesiredWidth = headerLeftRef.scrollWidth;
      const rightDesiredWidth = headerRightRef.scrollWidth;
      const totalDesired = leftDesiredWidth + rightDesiredWidth + MIN_GAP;

      if (totalDesired > containerWidth) {
        if (!collapsedStates[key]) {
          collapsedStates[key] = true;
          await tick();
          await new Promise(r => requestAnimationFrame(r));
        }
      } else {
        if (!isExpanding) break; 
      }
    }
    
    isUpdatingLayout = false;
  }

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
      setTimeout(updateAdaptiveLayout, 100);
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

    const resizeObserver = new ResizeObserver(() => {
      updateAdaptiveLayout();
    });
    
    if (headerContentRef) resizeObserver.observe(headerContentRef);

    const initTauri = async () => {
      if (isTauri) {
        window.addEventListener("mousedown", async (e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest(".drag-handle") || 
            target.closest(".card-wrapper") || 
            target.closest(".tab") ||
            target.closest(".scale-control") ||
            target.closest("[draggable='true']") ||
            target.draggable === true
          ) {
            return;
          }

          if (
            target.hasAttribute("data-tauri-drag-region") ||
            target.closest("[data-tauri-drag-region]")
          ) {
            try {
              const { getCurrentWindow } = await import(
                "@tauri-apps/api/window"
              );
              const appWindow = getCurrentWindow();
              if (e.button === 0 && !target.closest("button, input, a, textarea")) {
                await appWindow.startDragging();
              }
            } catch (err) {
              logService.error("drag", "Failed to start dragging programmatically", err);
            }
          }
        });

        try {
          const { enable, isEnabled } = await import("@tauri-apps/plugin-autostart");
          const autostartActive = await isEnabled();
          if (!autostartActive) await enable();
        } catch (err) {
          logService.error("app", "Failed to setup autostart", err);
        }
      } else {
        handleRefreshTabs();
      }
    };

    initTauri();

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("wheel", onWheel);
      resizeObserver.disconnect();
    };
  });

  const themeOptions = [
    { id: "dark-gray", label: "", icon: Moon },
    { id: "light-gray", label: "", icon: Sun },
    { id: "orange", label: "", icon: Citrus },
    { id: "green", label: "", icon: Leaf },
  ];

  const langOptions = [
    { id: "uk", label: "UK" },
    { id: "en", label: "EN" },
  ];

  const bgOptions = [
    { id: "none", label: "Off" },
    { id: "waves", label: "", icon: Waves, iconClass: "lucide-waves" },
    { id: "particles", label: "", icon: Sparkles, iconClass: "lucide-sparkles" },
    { id: "floating_shapes", label: "", icon: Shapes, iconClass: "lucide-shapes" },
  ];
</script>

<DynamicBackground />

<div class="theme-transition-overlay" class:active={theme.isChanging}></div>

<div class="app-content" class:language-changing={language.isChanging} class:is-minimal={uiState.isMinimalMode}>
  <svelte:boundary onerror={(err) => logService.log("error", "Global rendering error", err)}>
    {#if !appState.isConnected}
      <EmptyState />
    {:else}
      <div class="app-shell" class:is-minimal={uiState.isMinimalMode} data-testid="app-shell">
        {#if !uiState.isMinimalMode}
          <header class="app-header" data-tauri-drag-region data-testid="app-header">
            <div class="drag-layer" data-tauri-drag-region></div>

            <div class="header-content" bind:this={headerContentRef}>
              <div class="header-left" bind:this={headerLeftRef} data-tauri-drag-region data-testid="header-left">
                <h1 class="app-logo" data-tauri-drag-region data-testid="app-logo">
                  <span class="logo-icon" data-tauri-drag-region><Zap size={20} /></span>
                  {t.app.title}
                </h1>
                <div class="header-divider" data-tauri-drag-region></div>
                <span class="root-name" data-tauri-drag-region title={appState.rootName} data-testid="root-name-label">
                  <FolderOpen size={16} /> {appState.rootName}
                </span>
              </div>

              <!-- Combined Adaptive Controls -->
              <div class="header-right" bind:this={headerRightRef} data-tauri-drag-region data-testid="header-right">
                <!-- 1. View Toggles -->
                <div class="adaptive-group" class:collapsed={collapsedStates.view}>
                  <SegmentedToggle
                    id="card-view"
                    options={[
                      { id: "short", label: t.app.viewShort },
                      { id: "full", label: t.app.viewFull },
                    ]}
                    value={appState.cardView}
                    onSelect={(id) => setCardView(id)}
                    isCompact={collapsedStates.view}
                  />
                </div>

                <div class="header-divider" data-tauri-drag-region></div>

                <!-- 2. Card Density -->
                <div class="adaptive-group" class:collapsed={collapsedStates.density}>
                  <SegmentedToggle
                    id="card-density"
                    options={[
                      { id: "compact", label: t.app.densityCompact },
                      { id: "normal", label: t.app.densityNormal },
                      { id: "expanded", label: t.app.densityExpanded },
                    ]}
                    value={appState.cardDensity}
                    onSelect={(id) => setCardDensity(id)}
                    isCompact={collapsedStates.density}
                  />
                </div>

                <div class="header-divider" data-tauri-drag-region></div>

                <!-- 3. Theme Toggle -->
                <div class="adaptive-group" class:collapsed={collapsedStates.theme}>
                  <SegmentedToggle
                    id="theme"
                    options={themeOptions}
                    value={theme.current}
                    onSelect={(id) => theme.set(id as any)}
                    isCompact={collapsedStates.theme}
                  />
                </div>

                <!-- 4. Language Toggle -->
                <div class="adaptive-group" class:collapsed={collapsedStates.language}>
                  <SegmentedToggle
                    id="language"
                    options={langOptions}
                    value={language.current}
                    onSelect={(id) => language.set(id)}
                    isCompact={collapsedStates.language}
                  />
                </div>

                <!-- 5. Background Toggle -->
                <div class="adaptive-group" class:collapsed={collapsedStates.background}>
                  <SegmentedToggle
                    id="background"
                    options={bgOptions}
                    value={background.type}
                    onSelect={(id) => background.set(id)}
                    isCompact={collapsedStates.background}
                  />
                </div>

                <div class="header-divider"></div>

                <!-- Scale control -->
                <div class="scale-control" data-testid="scale-control" data-tauri-drag-region="false">
                  <button class="scale-btn" onclick={() => adjustScale(-0.1)} title="Зменшити масштаб" data-testid="btn-scale-down">-</button>
                  <span class="scale-value" class:dragging={isDraggingScale} onmousedown={handleScaleMouseDown} oncontextmenu={(e) => { e.preventDefault(); setScale(1.0); }} onkeydown={handleScaleKeydown} role="button" tabindex="0" title="Затисніть для зміни, ПКМ — скинути" data-testid="scale-value">
                    <MousePointer2 size={12} class="drag-icon" />
                    {Math.round(appState.scale * 100)}%
                  </span>
                  <button class="scale-btn" onclick={() => adjustScale(0.1)} title="Збільшити масштаб" data-testid="btn-scale-up">+</button>
                </div>

                <button class="icon-btn" onclick={() => handleRefreshTabs()} title={t.app.refresh} data-testid="btn-refresh">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M14.5 3.5A7 7 0 1 0 16 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    <path d="M14.5 1v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>

                <button class="icon-btn" onclick={() => connectDirectory()} title={t.app.changeDir} data-testid="btn-change-directory">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M2 4.5c0-1 .7-1.7 1.7-1.7h2.8c.4 0 .8.2 1.1.5l.7.7c.3.3.7.5 1.1.5H14.3c1 0 1.7.7 1.7 1.7v6.1c0 1-.7 1.7-1.7 1.7H3.7c-1 0-1.7-.7-1.7-1.7V4.5z" stroke="currentColor" stroke-width="1.5" fill="none" />
                  </svg>
                </button>

                <button class="icon-btn" onclick={() => globalSettingsModal?.open()} title={t.common.settings} data-testid="btn-global-settings">
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </header>
        {/if}

        {#if !uiState.isMinimalMode}
          <div class="tab-bar-wrapper" data-testid="tab-bar">
            <TabBar />
          </div>
        {/if}

        <main class="app-main" class:is-minimal={uiState.isMinimalMode} class:no-scroll={fsState.activeTab?.type === 'keyboard'} data-testid="app-main">
          {#if fsState.activeTab?.type === 'keyboard'}
            <StartMenu />
          {:else}
            <CardGrid />
          {/if}
        </main>

        {#if !uiState.isMinimalMode && fsState.activeTab?.type !== 'keyboard'}
          <FAB />
        {/if}
      </div>
    {/if}

    {#snippet failed(error, reset)}
      <GlobalErrorFallback {error} {reset} />
    {/snippet}
  </svelte:boundary>
</div>

<Toast />
<BatchActionBar />
<ContextMenu />
<CardSettingsModal />
<TabSettingsModal />
<HotkeyConflictModal />
<HotkeyPickerModal />
<ProgramPickerModal />
<GlobalSettingsModal bind:this={globalSettingsModal} />
<DebugListener />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-5);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    user-select: none;
    cursor: default;
    position: relative;
    z-index: 100;
  }

  /* ADAPTIVE STYLES */
  .adaptive-group {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .adaptive-group :global(.view-full) {
    display: flex !important;
  }
  .adaptive-group :global(.view-compact) {
    display: none !important;
  }

  .adaptive-group.collapsed :global(.view-full) {
    display: none !important;
  }
  .adaptive-group.collapsed :global(.view-compact) {
    display: flex !important;
  }

  .drag-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .header-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    pointer-events: none;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    pointer-events: auto;
  }

  .header-left {
    flex-shrink: 1; /* Allow shrinking if space is tight */
    min-width: 0;   /* Essential for truncation */
    overflow: hidden;
  }

  .header-right {
    flex-shrink: 0; /* NEVER cut off settings and controls */
    justify-content: flex-end;
  }

  .app-logo {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    background: var(--color-accent-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    flex-shrink: 1; /* Allow logo text to shrink */
    min-width: 32px; /* Keep at least the icon space */
    white-space: nowrap;
    overflow: hidden;
  }

  .logo-icon {
    -webkit-text-fill-color: initial;
    /* Using a subtle shadow based on accent color */
    filter: drop-shadow(0 0 8px rgba(var(--color-accent-rgb), 0.5));
  }

  .header-divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    flex-shrink: 1; /* Allow divider to disappear */
    min-width: 0;
    overflow: hidden;
  }

  .root-name {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    flex-shrink: 1; 
    min-width: 0; /* Changed from 50px to 0 to allow full collapse */
  }

  .scale-control {
    display: flex;
    align-items: center;
    background: var(--color-surface-1);
    border-radius: 10px;
    border: 1px solid var(--color-border);
    padding: 2px;
    flex-shrink: 0;
    height: 36px; /* Standardized height */
    box-sizing: border-box;
  }

  .scale-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 100%; /* Take full available height */
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 1.1rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .scale-btn:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .scale-value {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
    min-width: 50px;
    text-align: center;
    cursor: col-resize;
    user-select: none;
    transition: all var(--transition-fast);
    padding: 2px 6px;
    border-radius: 4px;
    outline: none;
  }

  :global(.drag-icon) {
    opacity: 0.4;
    color: var(--color-text-muted);
    transition: all 0.2s;
  }

  .scale-value:hover :global(.drag-icon),
  .scale-value.dragging :global(.drag-icon) {
    opacity: 1;
    color: var(--color-accent);
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-1);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
    transform: translateY(-1px);
  }

  .tab-bar-wrapper {
    background: var(--color-bg-secondary);
    flex-shrink: 0;
  }

  .app-main {
    flex: 1;
    overflow-y: auto;
    background-color: transparent;
    position: relative;
  }

  .app-main.no-scroll {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>