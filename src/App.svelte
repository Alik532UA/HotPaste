<script lang="ts">
  import { onMount } from "svelte";
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
  import { Sparkles, Waves, Shapes, CircleOff, Moon, Sun } from "lucide-svelte";

  const appState = getState();

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
      // Change 10% for every 50px moved
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

  // Scale reset handler for keyboard
  function handleScaleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setScale(1.0);
    }
  }

  // Global keyboard listener
  function onKeydown(e: KeyboardEvent) {
    handleGlobalKeydown(e);
  }

  // Global scroll zoom (Ctrl + scroll)
  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      adjustScale(delta);
    }
  }

  onMount(() => {
    theme.init();
    language.init();
    background.init();
    initUrlSync();

    // Auto-connect and setup if in Tauri
    const initTauri = async () => {
      // Improved check for Tauri v2
      // @ts-ignore
      const isTauri = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);

      logService.log("app", `Environment check: isTauri=${isTauri}`);

      if (isTauri) {
        logService.log("app", "Running in Tauri environment - connecting...");

        // Setup programmatic drag as a backup if attribute fails
        window.addEventListener("mousedown", async (e) => {
          const target = e.target as HTMLElement;
          if (
            target.hasAttribute("data-tauri-drag-region") ||
            target.closest("[data-tauri-drag-region]")
          ) {
            try {
              const { getCurrentWindow } = await import(
                "@tauri-apps/api/window"
              );
              const appWindow = getCurrentWindow();
              // Only start dragging if it's the primary mouse button and not on an interactive element
              if (e.button === 0 && !target.closest("button, input, a")) {
                await appWindow.startDragging();
              }
            } catch (err) {
              logService.error(
                "drag",
                "Failed to start dragging programmatically",
                err,
              );
            }
          }
        });
        try {
          await connectDirectory();
          logService.log(
            "app",
            `Connected successfully, appState.isConnected=${appState.isConnected}`,
          );
        } catch (err) {
          logService.error("app", "Failed to connect directory in Tauri", err);
        }

        // Setup autostart dynamically to avoid breaking web build
        try {
          // Standard dynamic import allow Vite to bundle this properly
          const { enable, isEnabled } = await import(
            "@tauri-apps/plugin-autostart"
          );
          const autostartActive = await isEnabled();
          if (!autostartActive) {
            await enable();
            logService.log("app", "Autostart enabled");
          }
        } catch (err) {
          logService.error("app", "Failed to setup autostart", err);
        }
      } else {
        logService.log("app", "Running in Web environment");
        handleRefreshTabs();
      }
    };

    initTauri();

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("wheel", onWheel);
    };
  });

  // Options for Segmented Controls
  const themeOptions = [
    { id: "dark", label: "", icon: Moon },
    { id: "light", label: "", icon: Sun },
  ];

  const langOptions = [
    { id: "uk", label: "UK" },
    { id: "en", label: "EN" },
  ];

  const bgOptions = [
    { id: "none", label: "Off", icon: CircleOff },
    { id: "waves", label: "", icon: Waves, iconClass: "lucide-waves" },
    {
      id: "particles",
      label: "",
      icon: Sparkles,
      iconClass: "lucide-sparkles",
    },
    {
      id: "floating_shapes",
      label: "",
      icon: Shapes,
      iconClass: "lucide-shapes",
    },
  ];
</script>

<DynamicBackground />

<div class="theme-transition-overlay" class:active={theme.isChanging}></div>

<div class="app-content" class:language-changing={language.isChanging}>
  <svelte:boundary
    onerror={(err) => logService.log("error", "Global rendering error", err)}
  >
    {#if !appState.isConnected}
      <!-- Landing / Empty State -->
      <EmptyState />
    {:else}
      <!-- Main App Layout -->
      <div class="app-shell" data-testid="app-shell">
        <!-- Top Header -->
        <header
          class="app-header"
          data-tauri-drag-region
          data-testid="app-header"
        >
          <!-- Full-height drag handle for better target area -->
          <div class="drag-layer" data-tauri-drag-region></div>

          <div class="header-content">
            <div
              class="header-left"
              data-tauri-drag-region
              data-testid="header-left"
            >
              <h1
                class="app-logo"
                data-tauri-drag-region
                data-testid="app-logo"
              >
                <span class="logo-icon" data-tauri-drag-region>⚡</span>
                {t.app.title}
              </h1>
              <div class="header-divider" data-tauri-drag-region></div>
              <span
                class="root-name"
                data-tauri-drag-region
                title={appState.rootName}
                data-testid="root-name-label">📂 {appState.rootName}</span
              >
            </div>

            <!-- View toggles (center) -->
            <div
              class="header-center"
              data-tauri-drag-region
              data-testid="header-center"
            >
              <SegmentedToggle
                id="card-view"
                options={[
                  { id: "short", label: t.app.viewShort },
                  { id: "full", label: t.app.viewFull },
                ]}
                value={appState.cardView}
                onSelect={(id) => setCardView(id)}
              />

              <div class="header-divider" data-tauri-drag-region></div>

              <SegmentedToggle
                id="card-density"
                options={[
                  { id: "compact", label: t.app.densityCompact },
                  { id: "normal", label: t.app.densityNormal },
                  { id: "expanded", label: t.app.densityExpanded },
                ]}
                value={appState.cardDensity}
                onSelect={(id) => setCardDensity(id)}
              />
            </div>

            <!-- Global Actions (right) -->
            <div
              class="header-right"
              data-tauri-drag-region
              data-testid="header-right"
            >
              <SegmentedToggle
                id="theme"
                options={themeOptions}
                value={theme.current}
                onSelect={() => theme.toggle()}
              />

              <SegmentedToggle
                id="language"
                options={langOptions}
                value={language.current}
                onSelect={(id) => language.set(id)}
              />

              <SegmentedToggle
                id="background"
                options={bgOptions}
                value={background.type}
                onSelect={(id) => background.set(id)}
              />

              <div class="header-divider"></div>

              <!-- Scale control -->
              <div class="scale-control" data-testid="scale-control">
                <button
                  class="scale-btn"
                  onclick={() => adjustScale(-0.1)}
                  aria-label="Зменшити масштаб"
                  data-testid="btn-scale-down"
                >
                  -
                </button>
                <span
                  class="scale-value"
                  class:dragging={isDraggingScale}
                  onmousedown={handleScaleMouseDown}
                  oncontextmenu={(e) => {
                    e.preventDefault();
                    setScale(1.0);
                  }}
                  onkeydown={handleScaleKeydown}
                  role="button"
                  tabindex="0"
                  aria-label="Скинути масштаб до 100%"
                  title="Затисніть для зміни, ПКМ або Enter — скинути до 100%"
                  data-testid="scale-value"
                >
                  {Math.round(appState.scale * 100)}%
                </span>
                <button
                  class="scale-btn"
                  onclick={() => adjustScale(0.1)}
                  aria-label="Збільшити масштаб"
                  data-testid="btn-scale-up"
                >
                  +
                </button>
              </div>

              <!-- Refresh button -->
              <button
                class="icon-btn"
                onclick={() => handleRefreshTabs()}
                title={t.app.refresh}
                aria-label={t.app.refresh}
                data-testid="btn-refresh"
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

              <!-- Change directory -->
              <button
                class="icon-btn"
                onclick={() => connectDirectory()}
                title={t.app.changeDir}
                aria-label={t.app.changeDir}
                data-testid="btn-change-directory"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M2 4.5c0-1 .7-1.7 1.7-1.7h2.8c.4 0 .8.2 1.1.5l.7.7c.3.3.7.5 1.1.5H14.3c1 0 1.7.7 1.7 1.7v6.1c0 1-.7 1.7-1.7 1.7H3.7c-1 0-1.7-.7-1.7-1.7V4.5z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    fill="none"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <!-- Tab Bar -->
        <div class="tab-bar-wrapper" data-testid="tab-bar-wrapper">
          <TabBar />
        </div>

        <!-- Main Content -->
        <main class="app-main" data-testid="app-main">
          {#if isTauri && appState.activeTabIndex === 0}
            <StartMenu />
          {:else}
            <CardGrid />
          {/if}
        </main>

        <!-- Floating Action Button for creating new card -->
        <FAB />
      </div>
    {/if}

    {#snippet failed(error, reset)}
      <GlobalErrorFallback {error} {reset} />
    {/snippet}
  </svelte:boundary>
</div>

<!-- Toast Notification -->
<Toast />

<BatchActionBar />

<ContextMenu />

<CardSettingsModal />

<TabSettingsModal />

<HotkeyConflictModal />

<HotkeyPickerModal />

<DebugListener />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Header */
  .app-header {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-5);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    /* Essential for Tauri drag region in frameless windows */
    user-select: none;
    cursor: default;
    position: relative;
    z-index: 100; /* Ensure header and its dropdowns are above app content */
  }

  /* Progressive Collapse for Segmented Toggles */

  /* 1. Background (collapses first) */
  @media (max-width: 1450px) {
    :global([data-testid="segmented-wrapper-background"] .view-full) {
      display: none !important;
    }
    :global([data-testid="segmented-wrapper-background"] .view-compact) {
      display: flex !important;
    }
  }

  /* 2. Language */
  @media (max-width: 1350px) {
    :global([data-testid="segmented-wrapper-language"] .view-full) {
      display: none !important;
    }
    :global([data-testid="segmented-wrapper-language"] .view-compact) {
      display: flex !important;
    }
  }

  /* 3. Theme */
  @media (max-width: 1270px) {
    :global([data-testid="segmented-wrapper-theme"] .view-full) {
      display: none !important;
    }
    :global([data-testid="segmented-wrapper-theme"] .view-compact) {
      display: flex !important;
    }
  }

  /* 4. Card Density */
  @media (max-width: 1220px) {
    :global([data-testid="segmented-wrapper-card-density"] .view-full) {
      display: none !important;
    }
    :global([data-testid="segmented-wrapper-card-density"] .view-compact) {
      display: flex !important;
    }
  }

  /* 5. Card View (collapses last) */
  @media (max-width: 1100px) {
    :global([data-testid="segmented-wrapper-card-view"] .view-full) {
      display: none !important;
    }
    :global([data-testid="segmented-wrapper-card-view"] .view-compact) {
      display: flex !important;
    }
  }

  .drag-layer {
    position: absolute;
    inset: 0;
    z-index: 0;
    /* This layer exists purely to catch drag events */
  }

  .header-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    pointer-events: none; /* Let clicks on gaps pass to drag-layer */
  }

  .header-left,
  .header-center,
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    pointer-events: auto; /* Enable for tooltips and controls */
  }

  /* Specific elements should allow dragging even if they have tooltips, 
     but we must ensure buttons/inputs remain clickable */
  .header-left > * {
    pointer-events: auto;
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
  }

  .logo-icon {
    -webkit-text-fill-color: initial;
    filter: drop-shadow(0 0 8px rgba(0, 210, 255, 0.5));
  }

  .header-divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
  }

  .root-name {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
  }

  /* Scale control */
  .scale-control {
    display: flex;
    align-items: center;
    background: var(--color-surface-1);
    border-radius: 10px;
    border: 1px solid var(--color-border);
    padding: 2px;
  }

  .scale-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
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
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
    min-width: 36px;
    text-align: center;
    cursor: col-resize;
    user-select: none;
    transition: all var(--transition-fast);
    padding: 2px 4px;
    border-radius: 4px;
    outline: none;
  }

  .scale-value:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-3);
  }

  .scale-value.dragging {
    color: var(--color-accent-cyan);
    background: var(--color-surface-3);
  }

  /* Icon buttons */
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
  }

  .icon-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
    transform: translateY(-1px);
  }

  .icon-btn:active {
    transform: translateY(0);
  }

  /* Tab Bar Wrapper */
  .tab-bar-wrapper {
    background: var(--color-bg-secondary);
    flex-shrink: 0;
  }

  /* Main Content */
  .app-main {
    flex: 1;
    overflow-y: auto;
    background-color: transparent; /* Changed to show dynamic bg */
    position: relative;
  }
</style>
