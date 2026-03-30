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
    { code: "isSpacer", label: "", isSpacer: true, width: 2 },
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
      { code: "Space", label: "Space", width: 6 },
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
      { code: "Numpad0", label: "0", width: 2.1 },
      { code: "NumpadDecimal", label: "." },
      { code: "isSpacer", label: "", isSpacer: true, width: 1 },
    ],
  ];

  // Navigation Pane (30 keys)
  const navigationPaneRow: KeyInfo[] = Array.from({ length: 30 }, (_, i) => ({
    code: `Nav${(i + 1).toString().padStart(2, '0')}`,
    label: (i + 1).toString(),
    isSmall: true
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

  onMount(() => {
    startMenuState.refreshShortcuts();

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (
        uiState.activeProgramPicker ||
        uiState.activeSettingsCard ||
        uiState.activeSettingsTab ||
        uiState.activeHotkeyPicker
      )
        return;

      if (isInputFocused()) return;

      const assignment = assignments[e.code];
      if (assignment && isKeyClickable(e.code)) {
        e.preventDefault();
        await handleLaunch(e.code);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Sync assignments from the active keyboard tab to the startMenuState
  $effect(() => {
    if (fsState.activeTab?.type === 'keyboard' && fsState.activeTab.assignments) {
      startMenuState.setAssignments(fsState.activeTab.assignments);
    }
  });

  async function handleKeyClick(key: KeyInfo) {
    if (["Escape", "Enter", "Space"].includes(key.code)) {
      await handleHide();
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
    if (code.startsWith("Digit")) return true;
    if (code.startsWith("F") && /^F[1-9][0-4]?$/.test(code)) {
      const num = parseInt(code.substring(1));
      return num >= 1 && num <= 24;
    }
    if (code.startsWith("Numpad") || code === "NumLock") return true;
    if (code.startsWith("Nav")) return true;
    if (
      [
        "BracketLeft",
        "BracketRight",
        "Backslash",
        "Semicolon",
        "Quote",
        "Comma",
        "Period",
        "Slash",
        "Backquote",
        "Minus",
        "Equal",
        "Backspace",
        "Tab",
        "CapsLock",
        "ShiftLeft",
        "ShiftRight",
        "ControlLeft",
        "ControlRight",
        "AltLeft",
        "AltRight",
        "MetaLeft",
        "MetaRight",
        "ContextMenu",
        "Space"
      ].includes(code)
    )
      return true;
    return false;
  }

  function isKeyClickable(code: string): boolean {
    return isKeyAssignable(code);
  }

  async function handleHide() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("hide_window");
    } catch (err) {
      console.error("Failed to hide window via command:", err);
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        getCurrentWindow().hide();
      } catch (innerErr) {
        console.error("Failed to hide window via JS API:", innerErr);
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
  <button
    class="key"
    class:is-small={key.isSmall}
    class:hovered={hoveredKey?.code === key.code}
    class:assigned={!!assignment}
    class:selected={uiState.activeProgramPicker?.key === key.code}
    class:disabled={!clickable}
    style="flex: {key.width || 1}"
    onmouseenter={() => (hoveredKey = key)}
    onmouseleave={() => (hoveredKey = null)}
    onclick={() => clickable && handleKeyClick(key)}
    oncontextmenu={(e) => clickable && handleKeyContextMenu(e, key)}
    type="button"
    disabled={!clickable && !assignment}
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
  >
    <div
      class="keyboard-layout-wrapper"
      data-testid="keyboard-layout-wrapper"
      data-tauri-drag-region
    >
      <!-- F1-F12 Row -->
      {#if layout.f1_f12}
        <div class="keyboard-row f-row">
          {#each f1_f12_row as key}
            {#if key.isSpacer}
              <div class="key-spacer" style="flex: {key.width || 1}"></div>
            {:else}
              {@render renderKey(key)}
            {/if}
          {/each}
        </div>
      {/if}

      <!-- F13-F24 Row -->
      {#if layout.f13_f24}
        <div class="keyboard-row f-row">
          {#each f13_f24_row as key}
            {#if key.isSpacer}
              <div class="key-spacer" style="flex: {key.width || 1}"></div>
            {:else}
              {@render renderKey(key)}
            {/if}
          {/each}
        </div>
      {/if}

      <!-- Main Keyboard and Numpad Area -->
      <div class="main-area">
        <div class="main-keyboard-block">
          {#each mainKeyboardRows as row}
            <div class="keyboard-row">
              {#each row as key}
                {#if key.isSpacer}
                  <div class="key-spacer" style="flex: {key.width || 1}"></div>
                {:else}
                  {@render renderKey(key)}
                {/if}
              {/each}
            </div>
          {/each}
        </div>

        {#if layout.num_lock}
          <div class="numpad-block">
            {#each numpadRows as row}
              <div class="keyboard-row">
                {#each row as key}
                  {#if key.isSpacer}
                    <div class="key-spacer" style="flex: {key.width || 1}"></div>
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
    padding: 2cqmin;
    pointer-events: none;
    container-type: size;
  }

  .start-menu-container.minimal {
    padding: 1cqmin;
  }

  .keyboard-body {
    width: auto;
    max-width: 98%;
    background: var(--color-bg-primary);
    backdrop-filter: var(--backdrop-filter);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 1.5cqmin;
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
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
    gap: 0.5cqmin;
  }

  .main-area {
    display: flex;
    gap: 1.5cqmin;
  }

  .main-keyboard-block {
    display: flex;
    flex-direction: column;
    gap: 0.5cqmin;
    flex: 1;
  }

  .numpad-block {
    display: flex;
    flex-direction: column;
    gap: 0.5cqmin;
    border-left: 1px solid var(--color-border);
    padding-left: 1.5cqmin;
  }

  .keyboard-row {
    display: flex;
    gap: 0.4cqmin;
    height: 6cqmin;
  }

  .f-row {
    height: 4.5cqmin;
    margin-bottom: 0.5cqmin;
  }

  .navigation-pane-row {
    display: flex;
    gap: 0.3cqmin;
    height: 3cqmin;
    margin-top: 1cqmin;
    padding-top: 1cqmin;
    border-top: 1px solid var(--color-border);
  }

  .key {
    position: relative;
    height: 100%;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;
    min-width: 4cqmin;
  }

  .key.is-small {
    border-radius: 4px;
  }

  .key.is-small .key-label {
    font-size: 2.5cqmin;
  }

  .key:hover {
    background: var(--color-surface-2);
    border-color: var(--color-accent-cyan);
    box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent-cyan) 20%, transparent);
  }

  .key:active,
  .key.selected {
    transform: translateY(0.1cqmin);
    background: var(--color-bg-secondary);
  }

  .key.assigned {
    background: var(--color-surface-3);
    border: 1px solid color-mix(in srgb, var(--color-accent-cyan) 30%, var(--color-border));
  }

  .key.disabled {
    opacity: 0.3;
    background: transparent;
    cursor: default;
    pointer-events: none;
  }

  .key-label {
    position: absolute;
    top: 8%;
    left: 10%;
    font-size: 3cqmin;
    font-weight: 700;
    color: var(--color-text-muted);
    z-index: 2;
  }

  .key-app-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60%;
    height: 60%;
    margin-top: 10%;
  }

  :global(.key-app-icon) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .key-assignment-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 90%;
    height: 90%;
    margin-top: 10%;
  }

  .mode-icon .key-app-icon-container {
    width: 75%;
    height: 75%;
    margin-top: 15%;
  }

  .mode-text .key-assignment-label {
    font-size: 2.8cqmin;
    font-weight: 700;
    text-align: center;
  }

  .mode-both .key-app-icon-container {
    width: 40%;
    height: 40%;
    margin-top: 0;
  }

  .mode-both .key-assignment-label {
    font-size: 2cqmin;
    max-width: 95%;
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
    pointer-events: none;
  }
</style>
