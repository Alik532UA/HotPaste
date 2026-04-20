<script lang="ts">
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import {
    Rocket,
    Trash2,
    X,
    Activity,
    LayoutGrid,
    Folder,
    Search,
    Monitor,
    Play,
    Settings2,
    Power,
    RotateCcw,
    Moon,
    Zap,
    Lock,
    LogOut,
    Link,
    Terminal,
  } from "lucide-svelte";
  import { startMenuState } from "../states/startMenu.svelte";
  import { fsState } from "../stores/fileSystemState.svelte";
  import { uiState } from "../stores/uiState.svelte";
  import { copyCardByHotkey } from "../stores/appState.svelte";
  import type { ShortcutInfo } from "../types";
  import { t } from "../i18n";
  import { logService } from "../services/logService.svelte";
  import { isInputFocused, QWERTY_CODES } from "../utils/keyboardLayout";
  import IconRenderer from "./ui/IconRenderer.svelte";

  const LUCIDE_ICONS: Record<string, any> = {
    rocket: Rocket,
    power: Power,
    "rotate-ccw": RotateCcw,
    moon: Moon,
    zap: Zap,
    lock: Lock,
    "log-out": LogOut,
    link: Link,
    terminal: Terminal,
  };

  function getLucideIcon(iconStr: string) {
    if (!iconStr || !iconStr.startsWith("lucide:")) return Rocket;
    const name = iconStr.replace("lucide:", "");
    return LUCIDE_ICONS[name] || Rocket;
  }

  // Keyboard layout metadata
  interface KeyInfo {
    code: string;
    label: string;
    width?: number;
    isSpacer?: boolean;
    isSmall?: boolean;
    isHidden?: boolean;
  }

  // F1-F12 Row
  const f1_f12_row: KeyInfo[] = [
    { code: "Escape", label: "Esc", width: 1.5 },
    { code: "isSpacer", label: "", isSpacer: true, width: 0.5 },
    { code: "F1", label: "F1" },
    { code: "F2", label: "F2" },
    { code: "F3", label: "F3" },
    { code: "F4", label: "F4" },
    { code: "isSpacer", label: "", isSpacer: true, width: 0.5 },
    { code: "F5", label: "F5" },
    { code: "F6", label: "F6" },
    { code: "F7", label: "F7" },
    { code: "F8", label: "F8" },
    { code: "isSpacer", label: "", isSpacer: true, width: 0.5 },
    { code: "F9", label: "F9" },
    { code: "F10", label: "F10" },
    { code: "F11", label: "F11" },
    { code: "F12", label: "F12" },
  ];

  // F13-F24 Row
  const f13_f24_row: KeyInfo[] = [
    { code: "EscapeGhost", label: "", width: 1.5, isHidden: true },
    { code: "isSpacer", label: "", isSpacer: true, width: 0.5 },
    { code: "F13", label: "F13" },
    { code: "F14", label: "F14" },
    { code: "F15", label: "F15" },
    { code: "F16", label: "F16" },
    { code: "isSpacer", label: "", isSpacer: true, width: 0.5 },
    { code: "F17", label: "F17" },
    { code: "F18", label: "F18" },
    { code: "F19", label: "F19" },
    { code: "F20", label: "F20" },
    { code: "isSpacer", label: "", isSpacer: true, width: 0.5 },
    { code: "F21", label: "F21" },
    { code: "F22", label: "F22" },
    { code: "F23", label: "F23" },
    { code: "F24", label: "F24" },
  ];

  // Main QWERTY block rows
  const mainKeyboardRows: KeyInfo[][] = [
    [
      { code: "Backquote", label: "`" },
      { code: "Digit1", label: "1" },
      { code: "Digit2", label: "2" },
      { code: "Digit3", label: "3" },
      { code: "Digit4", label: "4" },
      { code: "Digit5", label: "5" },
      { code: "Digit6", label: "6" },
      { code: "Digit7", label: "7" },
      { code: "Digit8", label: "8" },
      { code: "Digit9", label: "9" },
      { code: "Digit0", label: "0" },
      { code: "Minus", label: "-" },
      { code: "Equal", label: "=" },
      { code: "Backspace", label: "←", width: 2 },
    ],
    [
      { code: "Tab", label: "Tab", width: 1.5 },
      { code: "KeyQ", label: "Q" },
      { code: "KeyW", label: "W" },
      { code: "KeyE", label: "E" },
      { code: "KeyR", label: "R" },
      { code: "KeyT", label: "T" },
      { code: "KeyY", label: "Y" },
      { code: "KeyU", label: "U" },
      { code: "KeyI", label: "I" },
      { code: "KeyO", label: "O" },
      { code: "KeyP", label: "P" },
      { code: "BracketLeft", label: "[" },
      { code: "BracketRight", label: "]" },
      { code: "Backslash", label: "\\", width: 1.5 },
    ],
    [
      { code: "CapsLock", label: "Caps", width: 1.8 },
      { code: "KeyA", label: "A" },
      { code: "KeyS", label: "S" },
      { code: "KeyD", label: "D" },
      { code: "KeyF", label: "F" },
      { code: "KeyG", label: "G" },
      { code: "KeyH", label: "H" },
      { code: "KeyJ", label: "J" },
      { code: "KeyK", label: "K" },
      { code: "KeyL", label: "L" },
      { code: "Semicolon", label: ";" },
      { code: "Quote", label: "'" },
      { code: "Enter", label: "Enter", width: 2.2 },
    ],
    [
      { code: "ShiftLeft", label: "Shift", width: 2.4 },
      { code: "KeyZ", label: "Z" },
      { code: "KeyX", label: "X" },
      { code: "KeyC", label: "C" },
      { code: "KeyV", label: "V" },
      { code: "KeyB", label: "B" },
      { code: "KeyN", label: "N" },
      { code: "KeyM", label: "M" },
      { code: "Comma", label: "," },
      { code: "Period", label: "." },
      { code: "Slash", label: "/" },
      { code: "ShiftRight", label: "Shift", width: 2.6 },
    ],
    [
      { code: "ControlLeft", label: "Ctrl", width: 1.2 },
      { code: "MetaLeft", label: "Win", width: 1.2 },
      { code: "AltLeft", label: "Alt", width: 1.2 },
      { code: "Space", label: "Space", width: 6.6 },
      { code: "AltRight", label: "Alt", width: 1.2 },
      { code: "MetaRight", label: "Win", width: 1.2 },
      { code: "ContextMenu", label: "Menu", width: 1.2 },
      { code: "ControlRight", label: "Ctrl", width: 1.2 },
    ],
  ];

  // Numpad rows
  const numpadRows: KeyInfo[][] = [
    [
      { code: "NumLock", label: "Num" },
      { code: "NumpadDivide", label: "/" },
      { code: "NumpadMultiply", label: "*" },
      { code: "NumpadSubtract", label: "-" },
    ],
    [
      { code: "Numpad7", label: "7" },
      { code: "Numpad8", label: "8" },
      { code: "Numpad9", label: "9" },
      { code: "NumpadAdd", label: "+", width: 1 },
    ],
    [
      { code: "Numpad4", label: "4" },
      { code: "Numpad5", label: "5" },
      { code: "Numpad6", label: "6" },
      { code: "isSpacer", label: "", isSpacer: true, width: 1 },
    ],
    [
      { code: "Numpad1", label: "1" },
      { code: "Numpad2", label: "2" },
      { code: "Numpad3", label: "3" },
      { code: "NumpadEnter", label: "↵", width: 1 },
    ],
    [
      { code: "Numpad0", label: "0", width: 2 },
      { code: "NumpadDecimal", label: "." },
      { code: "isSpacer", label: "", isSpacer: true, width: 1 },
    ],
  ];

  // Navigation Pane (30 keys)
  const navigationPaneRow: KeyInfo[] = Array.from({ length: 30 }, (_, i) => ({
    code: `Nav${(i + 1).toString().padStart(2, '0')}`,
    label: "",
    isSmall: true,
    width: 0.5
  }));

  // Map of key code -> ShortcutInfo
  const assignments = $derived(startMenuState.assignments);
  let hoveredKey = $state<KeyInfo | null>(null);

  // Layout settings from active tab
  const layout = $derived(fsState.activeTab?.keyboardLayout || {
    f1_f12: true,
    f13_f24: false,
    num_lock: false,
    navigation_pane: false
  });

  // Dynamic aspect ratio calculation to keep keys perfectly square
  const layoutInfo = $derived.by(() => {
    const padding = 2.5; // 2.5% cqi
    const gap = 1.2; // 1.2% cqi
    const blockGap = 1.5; // 1.5% cqi
    const fRowMargin = 0.5; // 0.5% cqi
    
    let fRowsCount = 0;
    if (layout.f1_f12) fRowsCount += 1;
    if (layout.f13_f24) fRowsCount += 1;
    const R = 5 + fRowsCount;
    
    let uRatio = 0;
    
    if (layout.num_lock) {
      // Equation: (15*u + 14*gap) + blockGap + (4*u + 3*gap) = 95
      // 19*u + 17*gap + blockGap = 95
      uRatio = (95 - blockGap - 17 * gap) / 19;
    } else {
      // Equation: 15*u + 14*gap = 95
      uRatio = (95 - 14 * gap) / 15;
    }
    
    const qwertyWidth = 15 * uRatio + 14 * gap;
    const numpadWidth = 4 * uRatio + 3 * gap;
    
    let hRatio = R * uRatio;
    hRatio += (R - 1) * gap;
    hRatio += fRowsCount * fRowMargin;
    
    if (layout.navigation_pane) {
      hRatio += 1.5; // margin-top
      hRatio += 1.0; // padding-top
      hRatio += (uRatio * 0.5); // Row height is based on square 0.5 keys
    }
    
    hRatio += 2 * padding;
    
    return {
      aspect: 100 / hRatio,
      keyHeightCqi: uRatio,
      qwertyWidth,
      numpadWidth,
      gap,
      blockGap,
      fRowMargin
    };
  });

  const totalMainRows = $derived(5 + (layout.f1_f12 ? 1 : 0) + (layout.f13_f24 ? 1 : 0));

  onMount(() => {
    startMenuState.refreshShortcuts();
  });

  import { untrack } from "svelte";

  // Sync assignments from the active keyboard tab to the startMenuState
  $effect(() => {
    const activeTab = fsState.activeTab;
    if (activeTab?.type === 'keyboard' && activeTab.assignments) {
      const assignments = activeTab.assignments;
      untrack(() => {
        startMenuState.setAssignments(assignments);
      });
    }
  });

  async function handleKeyClick(key: KeyInfo) {
    if (["Escape", "Enter", "Space"].includes(key.code)) {
      await handleHide();
      return;
    }

    const tabIndex = getTabIndexForKey(key.code);
    if (tabIndex !== null) {
      const targetTab = fsState.tabs[tabIndex];
      if (targetTab) {
        uiState.selectTab(tabIndex, fsState.tabs.length, targetTab.type);
      }
      return;
    }

    const assignment = assignments[key.code];
    if (assignment) {
      // Use the global hotkey handler which includes confirmation logic
      await copyCardByHotkey(key.code);
    } else {
      openPicker(key);
    }
  }

  function handleKeyContextMenu(e: MouseEvent, key: KeyInfo) {
    e.preventDefault();
    if (!isKeyAssignable(key.code)) return;
    openPicker(key);
  }

  function openPicker(key: KeyInfo) {
    if (fsState.activeTab) {
      uiState.openProgramPicker(key.code, fsState.activeTab);
    }
  }

  function isKeyAssignable(code: string): boolean {
    if (code.startsWith("Key")) return true;
    
    // Numeric row is reserved for tabs (1-0, -, =)
    if (code.startsWith("Digit") || code === "Minus" || code === "Equal") return false;

    // F1-F24
    if (code.startsWith("F")) {
      const numMatch = code.match(/^F(\d+)$/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        return num >= 1 && num <= 24;
      }
    }
    
    // Numpad (excluding NumLock)
    if (code.startsWith("Numpad")) return true;
    
    if (code.startsWith("Nav")) return true;
    
    // Only punctuation and symbol keys
    const allowedSymbols = [
        "BracketLeft",
        "BracketRight",
        "Backslash",
        "Semicolon",
        "Quote",
        "Comma",
        "Period",
        "Slash",
        "Backquote"
    ];
    
    return allowedSymbols.includes(code);
  }

  function getTabIndexForKey(code: string): number | null {
    if (code.startsWith("Digit")) {
      const num = parseInt(code.replace("Digit", ""), 10);
      return num === 0 ? 9 : num - 1;
    }
    if (code === "Minus") return 10;
    if (code === "Equal") return 11;
    return null;
  }

  function isKeyClickable(code: string): boolean {
    const tabIndex = getTabIndexForKey(code);
    if (tabIndex !== null) {
      return !!fsState.tabs[tabIndex];
    }
    return isKeyAssignable(code);
  }

  function getTabForKey(code: string) {
    const index = getTabIndexForKey(code);
    if (index !== null) return fsState.tabs[index];
    return null;
  }

  async function handleHide() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("hide_window");
    } catch (err) {
      logService.error('StartMenu', `Failed to hide window via command: ${err}`);
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        getCurrentWindow().hide();
      } catch (innerErr) {
        logService.error('StartMenu', `Failed to hide window via JS API: ${innerErr}`);
      }
    }
  }

  async function handleLaunch(keyCode: string) {
    await startMenuState.launchKey(keyCode);
    await handleHide();
  }

  // Debug icon helper with more robust format handling
  function getIconSrc(icon: any): string {
    if (!icon) return "";
    const iconStr = String(icon);
    if (iconStr.startsWith("data:")) return iconStr;
    if (iconStr.startsWith("lucide:")) return ""; // Handled in template
    // Assume pure base64 if no data prefix
    return `data:image/png;base64,${iconStr}`;
  }
</script>

{#snippet renderKey(key: KeyInfo)}
  {@const assignment = assignments[key.code]}
  {@const clickable = isKeyClickable(key.code)}
  {@const tab = getTabForKey(key.code)}
  <button
    class="key"
    class:is-small={key.isSmall}
    class:hovered={hoveredKey?.code === key.code}
    class:assigned={!!assignment}
    class:selected={uiState.activeProgramPicker?.key === key.code}
    class:disabled={!clickable}
    class:hidden={key.isHidden}
    class:has-tab-color={!!tab?.color}
    style="--key-width: {key.width || 1}; {tab?.color ? `--tab-color: ${tab.color}` : ''}"
    onmouseenter={() => (hoveredKey = key)}
    onmouseleave={() => (hoveredKey = null)}
    onclick={() => clickable && !key.isHidden && handleKeyClick(key)}
    oncontextmenu={(e) => clickable && !key.isHidden && handleKeyContextMenu(e, key)}
    type="button"
    disabled={(!clickable && !assignment) || key.isHidden}
    data-testid="key-{key.code}"
  >
    <span class="key-label">{key.label}</span>
    {#if assignment && assignment.displayMode !== 'none'}
      <div class="key-assignment-content" class:mode-icon={assignment.displayMode === 'icon'} class:mode-text={assignment.displayMode === 'text'} class:mode-both={assignment.displayMode === 'both'}>
        {#if assignment.displayMode === 'both' || assignment.displayMode === 'icon'}
          <div class="key-app-icon-container">
            {#if assignment.icon}
              <IconRenderer icon={assignment.icon} class="key-app-icon" size="100%" />
            {:else}
              <Rocket class="key-app-icon-fallback" />
            {/if}
          </div>
        {/if}
        
        {#if assignment.displayMode === 'both' || assignment.displayMode === 'text'}
          <span class="key-assignment-label">
            {assignment.customLabel || assignment.name}
          </span>
        {/if}
      </div>
    {/if}
  </button>
{/snippet}

<div
  class="start-menu-container"
  class:minimal={uiState.isMinimalMode}
  in:fade={{ duration: 300 }}
  data-testid="start-menu-container"
  data-tauri-drag-region
>
    <div
    class="keyboard-body"
    class:modal-open={!!uiState.activeProgramPicker}
    in:fly={{ y: 20, delay: 100 }}
    data-tauri-drag-region={!uiState.activeProgramPicker ? "" : undefined}
    data-testid="keyboard-body"
    style="--kb-aspect: {layoutInfo.aspect}; --key-height: {layoutInfo.keyHeightCqi}cqi; --qwerty-width: {layoutInfo.qwertyWidth}cqi; --numpad-width: {layoutInfo.numpadWidth}cqi; --key-gap: {layoutInfo.gap}cqi; --block-gap: {layoutInfo.blockGap}cqi; --f-margin: {layoutInfo.fRowMargin}cqi;"
  >
    <div
      class="keyboard-layout-wrapper"
      data-testid="keyboard-layout-wrapper"
      data-tauri-drag-region
      style="--main-rows: {totalMainRows};"
    >
      <!-- Main Keyboard and Numpad Area -->
      <div class="main-area" data-testid="kb-main-area">
        <div class="main-keyboard-block" data-testid="kb-qwerty-block">
          <!-- F13-F24 Row -->
          {#if layout.f13_f24}
            <div class="keyboard-row f-row">
              {#each f13_f24_row as key}
                {#if key.isSpacer}
                  <div class="key-spacer" style="--spacer-width: {key.width || 1}"></div>
                {:else}
                  {@render renderKey(key)}
                {/if}
              {/each}
            </div>
          {/if}

          <!-- F1-F12 Row -->
          {#if layout.f1_f12}
            <div class="keyboard-row f-row">
              {#each f1_f12_row as key}
                {#if key.isSpacer}
                  <div class="key-spacer" style="--spacer-width: {key.width || 1}"></div>
                {:else}
                  {@render renderKey(key)}
                {/if}
              {/each}
            </div>
          {/if}

          {#each mainKeyboardRows as row}
            <div class="keyboard-row">
              {#each row as key}
                {#if key.isSpacer}
                  <div class="key-spacer" style="--spacer-width: {key.width || 1}"></div>
                {:else}
                  {@render renderKey(key)}
                {/if}
              {/each}
            </div>
          {/each}
        </div>

        {#if layout.num_lock}
          <div class="numpad-block">
            <!-- Add spacers to align NumPad with QWERTY when F-rows are present -->
            {#if layout.f13_f24}
              <div class="keyboard-row spacer-row"></div>
            {/if}
            {#if layout.f1_f12}
              <div class="keyboard-row spacer-row"></div>
            {/if}

            {#each numpadRows as row}
              <div class="keyboard-row">
                {#each row as key}
                  {#if key.isSpacer}
                    <div class="key-spacer" style="--spacer-width: {key.width || 1}"></div>
                  {:else}
                    {@render renderKey(key)}
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Navigation Pane -->
      {#if layout.navigation_pane}
        <div class="navigation-pane-row">
          {#each navigationPaneRow as key}
            {@render renderKey(key)}
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .start-menu-container {
    position: absolute;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2%;
    pointer-events: none;
    container-type: size;
  }

  .start-menu-container.minimal {
    padding: 1%;
  }

  .keyboard-body {
    width: min(95%, calc(92cqh * var(--kb-aspect)));
    max-width: 1200px;
    height: auto;
    max-height: 95cqh;
    aspect-ratio: var(--kb-aspect) / 1;
    background: var(--color-bg-primary);
    backdrop-filter: var(--backdrop-filter);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 2.5cqi;
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    transition:
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    overflow: hidden;
    container-type: inline-size;
  }

  .keyboard-body.modal-open {
    transform: scale(0.98);
    opacity: 0.5;
    filter: blur(4px);
    pointer-events: none;
  }

  .keyboard-layout-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--key-gap);
    width: 100%;
    height: 100%;
  }

  .main-area {
    display: flex;
    gap: var(--block-gap);
    width: 100%;
    flex: var(--main-rows, 5);
  }

  .main-keyboard-block {
    display: flex;
    flex-direction: column;
    gap: var(--key-gap);
    width: var(--qwerty-width);
    flex: none;
    height: 100%;
  }

  .numpad-block {
    display: flex;
    flex-direction: column;
    gap: var(--key-gap);
    width: var(--numpad-width);
    flex: none;
    height: 100%;
  }

  .spacer-row {
    pointer-events: none;
    visibility: hidden;
    height: var(--key-height);
    flex: 0 0 auto;
    margin-bottom: var(--f-margin);
  }

  .keyboard-row {
    display: flex;
    gap: var(--key-gap);
    width: 100%;
    height: var(--key-height);
    flex: 0 0 auto;
  }

  .f-row {
    margin-bottom: var(--f-margin);
  }

  .navigation-pane-row {
    display: flex;
    gap: 0.4cqi;
    margin-top: 1.5cqi;
    padding-top: 1cqi;
    border-top: 1px solid var(--color-border);
    width: 100%;
    height: auto;
    flex: 0 0 auto;
  }

  .key {
    position: relative;
    flex: var(--key-width, 1);
    width: 0;
    min-width: 0;
    height: 100%;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 0.8cqi;
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;
    container-type: size;
  }

  .key.is-small {
    flex: var(--key-width, 0.5);
    width: 0;
    height: auto;
    aspect-ratio: 1 / 1;
    border-radius: 0.4cqi;
  }

  .key:hover {
    background: var(--color-surface-2);
    border-color: var(--color-accent-cyan);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--color-accent-cyan) 20%, transparent);
  }

  .key:active,
  .key.selected {
    transform: translateY(0.2cqi);
    box-shadow: var(--shadow-sm);
    background: var(--color-bg-secondary);
  }

  .key.assigned {
    background: var(--color-surface-3);
    border: 1px solid
      color-mix(in srgb, var(--color-accent-cyan) 30%, var(--color-border));
  }

  .key.disabled {
    opacity: 0.4;
    background: transparent;
    cursor: default;
    pointer-events: none;
  }

  .key.has-tab-color {
    box-shadow: inset 0 0 16px color-mix(in srgb, var(--tab-color) 65%, transparent);
    border-color: color-mix(in srgb, var(--tab-color) 45%, var(--color-border));
  }

  .key.has-tab-color:hover {
    background: color-mix(in srgb, var(--tab-color) 15%, var(--color-surface-1));
    box-shadow: inset 0 0 24px color-mix(in srgb, var(--tab-color) 85%, transparent);
    border-color: var(--tab-color);
  }

  .key.hidden {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }

  .key-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 45cqh;
    font-weight: 700;
    color: var(--color-text-muted);
    letter-spacing: -0.01em;
    z-index: 2;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    line-height: 1;
  }

  .key.assigned .key-label {
    top: 10%;
    left: 10%;
    transform: none;
    font-size: 22cqh;
    opacity: 0.8;
  }

  .key.disabled .key-label {
    font-size: 40cqh;
    font-weight: 500;
  }

  .key-app-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 55%;
    height: 55%;
    margin-top: 8%;
  }

  :global(.key-app-icon) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .key-assignment-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5%;
  }

  .mode-icon .key-app-icon-container {
    width: 70%;
    height: 70%;
    margin-top: 8%;
  }

  .mode-text .key-assignment-label {
    font-size: 25cqh;
    font-weight: 700;
    text-align: center;
    margin-top: 8%;
  }

  .mode-both .key-app-icon-container {
    width: 35%;
    height: 35%;
    margin-top: 4%;
  }

  .mode-both .key-assignment-label {
    font-size: 18cqh;
    max-width: 95%;
    margin-top: 2%;
  }

  .key-assignment-label {
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    text-align: center;
  }

  .key-spacer {
    flex: var(--spacer-width, 1);
    width: 0;
    min-width: 0;
    height: 100%;
    pointer-events: none;
  }
</style>
