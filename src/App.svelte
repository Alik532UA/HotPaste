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
  import Toast from "./lib/components/Toast.svelte";
  import EmptyState from "./lib/components/EmptyState.svelte";
  import FAB from "./lib/components/FAB.svelte";
  import ContextMenu from "./lib/components/ContextMenu.svelte";
  import CardSettingsModal from "./lib/components/CardSettingsModal.svelte";
  import TabSettingsModal from "./lib/components/TabSettingsModal.svelte";
  import HotkeyConflictModal from "./lib/components/HotkeyConflictModal.svelte";
  import HotkeyPickerModal from "./lib/components/HotkeyPickerModal.svelte";
  import DebugListener from "./lib/components/DebugListener.svelte";
  import { theme } from "./lib/states/theme.svelte";
  import { language } from "./lib/i18n/language.svelte";
  import { t } from "./lib/i18n";

  const appState = getState();

  /** Scale dragging logic */
  let isDraggingScale = $state(false);
  let startDragX = $state(0);
  let startScale = $state(1.0);

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
    refreshTabs();

    document.addEventListener("keydown", onKeydown);
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("wheel", onWheel);
    };
  });
</script>

<div class="theme-transition-overlay" class:active={theme.isChanging}></div>

<div class="app-content" class:language-changing={language.isChanging}>
  {#if !appState.isConnected}
    <!-- Landing / Empty State -->
    <EmptyState />
  {:else}
    <!-- Main App Layout -->
    <div class="app-shell" data-testid="app-shell">
      <!-- Top Header -->
      <header class="app-header" data-testid="app-header">
        <div class="header-left" data-testid="header-left">
          <h1 class="app-logo" data-testid="app-logo">
            <span class="logo-icon">⚡</span>
            {t.app.title}
          </h1>
          <div class="header-divider"></div>
          <span
            class="root-name"
            title={appState.rootName}
            data-testid="root-name-label">📂 {appState.rootName}</span
          >
        </div>

        <!-- View toggles (center) -->
        <div class="header-center" data-testid="header-center">
          <!-- Card view: short / full -->
          <div
            class="toggle-group"
            id="view-toggle"
            data-testid="view-toggle-group"
          >
            <button
              class="toggle-btn"
              class:active={appState.cardView === "short"}
              onclick={() => setCardView("short")}
              title={t.app.viewShort}
              data-testid="btn-view-short"
            >
              {t.app.viewShort}
            </button>
            <button
              class="toggle-btn"
              class:active={appState.cardView === "full"}
              onclick={() => setCardView("full")}
              title={t.app.viewFull}
              data-testid="btn-view-full"
            >
              {t.app.viewFull}
            </button>
          </div>

          <div class="header-divider"></div>

          <!-- Density toggle: compact / normal / expanded -->
          <div
            class="toggle-group"
            id="density-toggle"
            data-testid="density-toggle-group"
          >
            <button
              class="toggle-btn"
              class:active={appState.cardDensity === "compact"}
              onclick={() => setCardDensity("compact")}
              title={t.app.densityCompact}
              data-testid="btn-density-compact"
            >
              {t.app.densityCompact}
            </button>
            <button
              class="toggle-btn"
              class:active={appState.cardDensity === "normal"}
              onclick={() => setCardDensity("normal")}
              title={t.app.densityNormal}
              data-testid="btn-density-normal"
            >
              {t.app.densityNormal}
            </button>
            <button
              class="toggle-btn"
              class:active={appState.cardDensity === "expanded"}
              onclick={() => setCardDensity("expanded")}
              title={t.app.densityExpanded}
              data-testid="btn-density-expanded"
            >
              {t.app.densityExpanded}
            </button>
          </div>
        </div>

        <!-- Global Actions (right) -->
        <div class="header-right" data-testid="header-right">
          <!-- Theme Toggle -->
          <button
            class="icon-btn theme-toggle"
            onclick={() => theme.toggle()}
            title="Змінити тему"
            data-testid="btn-toggle-theme"
          >
            {#if theme.current === "dark"}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            {:else}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            {/if}
          </button>

          <!-- Language Toggle -->
          <button
            class="lang-btn"
            onclick={() => language.set(language.current === "uk" ? "en" : "uk")}
            data-testid="btn-toggle-lang"
          >
            {language.current.toUpperCase()}
          </button>

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
            onclick={() => refreshTabs()}
            title="Оновити"
            aria-label="Оновити файли"
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
            title="Змінити папку"
            aria-label="Обрати іншу папку"
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
      </header>

      <!-- Tab Bar -->
      <div class="tab-bar-wrapper" data-testid="tab-bar-wrapper">
        <TabBar />
      </div>

      <!-- Main Content -->
      <main class="app-main" data-testid="app-main">
        <CardGrid />
      </main>

      <!-- Floating Action Button for creating new card -->
      <FAB />
    </div>
  {/if}
</div>

<!-- Toast Notification -->
<Toast />

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
  }

  .header-left,
  .header-center,
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
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

  /* Toggles */
  .toggle-group {
    display: flex;
    background: var(--color-surface-1);
    padding: 2px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
  }

  .toggle-btn {
    padding: 6px 12px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .toggle-btn:hover {
    color: var(--color-text-secondary);
    background: var(--color-surface-3);
  }

  .toggle-btn.active {
    background: var(--color-surface-3);
    color: var(--color-accent-cyan);
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

  /* Language toggle button */
  .lang-btn {
    padding: 0 10px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-1);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .lang-btn:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
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
    background-color: var(--color-bg-primary);
    position: relative;
  }
</style>
