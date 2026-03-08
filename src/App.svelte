<script lang="ts">
  import { onMount } from "svelte";
  import {
    getState,
    handleGlobalKeydown,
    connectDirectory,
    adjustScale,
    refreshTabs,
    setAppMode,
    setCardView,
  } from "./lib/stores/appState.svelte";
  import TabBar from "./lib/components/TabBar.svelte";
  import CardGrid from "./lib/components/CardGrid.svelte";
  import Toast from "./lib/components/Toast.svelte";
  import EmptyState from "./lib/components/EmptyState.svelte";

  const appState = getState();

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
    document.addEventListener("keydown", onKeydown);
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("wheel", onWheel);
    };
  });
</script>

{#if !appState.isConnected}
  <!-- Landing / Empty State -->
  <EmptyState />
{:else}
  <!-- Main App Layout -->
  <div class="app-shell">
    <!-- Top Header -->
    <header class="app-header">
      <div class="header-left">
        <h1 class="app-logo">
          <span class="logo-gradient">Hot</span>Paste
        </h1>
        <div class="header-divider"></div>
        <span class="root-name" title={appState.rootName}
          >📂 {appState.rootName}</span
        >
      </div>

      <!-- Mode toggles (center) -->
      <div class="header-center">
        <!-- App mode: copy / edit -->
        <div class="toggle-group" id="mode-toggle">
          <button
            class="toggle-btn"
            class:active={appState.appMode === "copy"}
            onclick={() => setAppMode("copy")}
            title="Режим копіювання: натискання на картку копіює текст"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect
                x="4"
                y="1"
                width="9"
                height="10"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.3"
                fill="none"
              />
              <path
                d="M10 4H3.5A1.5 1.5 0 0 0 2 5.5V12"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
            </svg>
            Копіювання
          </button>
          <button
            class="toggle-btn"
            class:active={appState.appMode === "edit"}
            onclick={() => setAppMode("edit")}
            title="Режим редагування: натискання на картку відкриває редактор"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M8.5 2.5l3 3L4.5 12.5H1.5v-3l7-7z"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linejoin="round"
                fill="none"
              />
              <path d="M7 4l3 3" stroke="currentColor" stroke-width="1.3" />
            </svg>
            Редагування
          </button>
        </div>

        <div class="header-divider"></div>

        <!-- Card view: short / full -->
        <div class="toggle-group" id="view-toggle">
          <button
            class="toggle-btn"
            class:active={appState.cardView === "short"}
            onclick={() => setCardView("short")}
            title="Короткий вигляд: текст обрізається"
          >
            Короткий
          </button>
          <button
            class="toggle-btn"
            class:active={appState.cardView === "full"}
            onclick={() => setCardView("full")}
            title="Повний вигляд: весь текст видно"
          >
            Повний
          </button>
        </div>
      </div>

      <div class="header-right">
        <!-- Scale indicator -->
        <div class="scale-control">
          <button
            class="scale-btn"
            onclick={() => adjustScale(-0.1)}
            aria-label="Зменшити масштаб">−</button
          >
          <span class="scale-value">{Math.round(appState.scale * 100)}%</span>
          <button
            class="scale-btn"
            onclick={() => adjustScale(0.1)}
            aria-label="Збільшити масштаб">+</button
          >
        </div>

        <!-- Refresh button -->
        <button
          class="icon-btn"
          onclick={() => refreshTabs()}
          title="Оновити"
          aria-label="Оновити файли"
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
    <div class="tab-bar-wrapper">
      <TabBar />
    </div>

    <!-- Main Content -->
    <main class="app-main">
      <CardGrid />
    </main>
  </div>
{/if}

<!-- Toast Notification -->
<Toast />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* Header */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .app-logo {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  .logo-gradient {
    background: var(--color-accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-divider {
    width: 1px;
    height: 20px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  .root-name {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  /* Scale control */
  .scale-control {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    padding: 2px;
  }

  .scale-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 1rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all var(--transition-fast);
    font-family: var(--font-family);
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
  }

  /* Icon buttons */
  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .icon-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-surface-3);
    border-color: var(--color-border-hover);
  }

  /* Tab bar wrapper */
  .tab-bar-wrapper {
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-border);
  }

  /* Main content */
  .app-main {
    flex: 1;
    overflow-y: auto;
  }

  /* Header center — mode toggles */
  .header-center {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* Toggle group (segmented control) */
  .toggle-group {
    display: flex;
    align-items: center;
    background: var(--color-surface-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    padding: 2px;
    gap: 2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-family);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
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
</style>
