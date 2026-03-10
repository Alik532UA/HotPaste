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
  } from "lucide-svelte";
  import { startMenuState } from "../states/startMenu.svelte";
  import { fsState } from "../stores/fileSystemState.svelte";
  import { uiState } from "../stores/uiState.svelte";
  import { t } from "../i18n";
  import { logService } from "../services/logService.svelte";

  // Keyboard layout metadata
  interface KeyInfo {
    code: string;
    label: string;
    width?: number;
    isSpacer?: boolean;
  }

  const keyboardRows: KeyInfo[][] = [
    // Row 1: F-keys
    [
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
    ],
    // Row 2: Numbers
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
      { code: "Backspace", label: "Backspace", width: 2 },
    ],
    // Row 3: QWERTY
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
    // Row 4: ASDF
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
    // Row 5: ZXCV
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
    // Row 6: Space
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

  // Map of key code -> ShortcutInfo
  const assignments = $derived(fsState.activeTab?.assignments || {});
  let hoveredKey = $state<KeyInfo | null>(null);

  onMount(() => {
    startMenuState.refreshShortcuts();

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (
        uiState.activeProgramPicker ||
        uiState.activeSettingsCard ||
        uiState.activeSettingsTab ||
        uiState.activeHotkeyPickerCard
      )
        return;

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (["INPUT", "TEXTAREA"].includes(activeEl.tagName.toUpperCase()) ||
          (activeEl as HTMLElement).isContentEditable);
      if (isInput) return;

      const assignment = assignments[e.code];
      if (assignment && isKeyClickable(e.code)) {
        e.preventDefault();
        await handleLaunch(e.code);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function handleKeyClick(key: KeyInfo) {
    if (["Escape", "Enter", "Space"].includes(key.code)) {
      await handleHide();
      return;
    }

    const assignment = assignments[key.code];
    if (assignment) {
      await handleLaunch(key.code);
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
    if (code.startsWith("F") && /^F[1-9][0-2]?$/.test(code)) {
      const num = parseInt(code.substring(1));
      return num >= 1 && num <= 12;
    }
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
    startMenuState.launchKey(keyCode, assignments);
    await handleHide();
  }

  // Debug icon helper with more robust format handling
  function getIconSrc(icon: any): string {
    if (!icon) return "";
    const iconStr = String(icon);
    if (iconStr.startsWith("data:")) return iconStr;
    // Assume pure base64 if no data prefix
    return `data:image/png;base64,${iconStr}`;
  }
</script>

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
      class="keyboard-container"
      data-testid="keyboard-container"
      data-tauri-drag-region
    >
      {#each keyboardRows as row}
        <div class="keyboard-row" data-tauri-drag-region>
          {#each row as key}
            {#if key.isSpacer}
              <div class="key-spacer" style="flex: {key.width || 1}"></div>
            {:else}
              {@const assignment = assignments[key.code]}
              {@const clickable = isKeyClickable(key.code)}
              <button
                class="key"
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
                {#if assignment}
                  <div class="key-app-icon-container">
                    {#if assignment.icon}
                      <img
                        src={getIconSrc(assignment.icon)}
                        alt=""
                        class="key-app-icon"
                      />
                    {:else}
                      <Rocket class="key-app-icon-fallback" />
                    {/if}
                  </div>
                {/if}
              </button>
            {/if}
          {/each}
        </div>
      {/each}
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

  .start-menu-container.minimal .keyboard-body {
    width: min(100%, calc(100cqh * var(--kb-aspect)));
    border-radius: var(--radius-md);
    border: none;
  }

  .keyboard-body {
    --kb-aspect: 2.8;
    aspect-ratio: var(--kb-aspect) / 1;
    width: min(95%, calc(92cqh * var(--kb-aspect)));
    height: auto;
    background: var(--color-bg-primary);
    backdrop-filter: var(--backdrop-filter);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: 2cqmin;
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
    transition:
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s ease;
    container-type: size;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .keyboard-body.modal-open {
    transform: scale(0.98);
    opacity: 0.5;
    filter: blur(4px);
    pointer-events: none;
  }

  .keyboard-container {
    display: flex;
    flex-direction: column;
    gap: 0.4cqmin;
    width: 100%;
    height: 100%;
    justify-content: space-between;
  }

  .keyboard-row {
    display: flex;
    gap: 3.8cqmin;
    width: 100%;
    height: 14%;
  }

  .key-spacer {
    pointer-events: none;
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
  }

  .key:hover {
    background: var(--color-surface-2);
    border-color: var(--color-accent-cyan);
    box-shadow: 0 0 10px
      color-mix(in srgb, var(--color-accent-cyan) 20%, transparent);
  }

  .key:active,
  .key.selected {
    transform: translateY(0.2cqmin);
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

  .key-label {
    position: absolute;
    top: 10%;
    left: 10%;
    font-size: 4cqmin; /* INCREASED: much larger labels */
    font-weight: 700;
    color: var(--color-text-muted);
    letter-spacing: -0.01em;
    z-index: 2;
  }

  .key.disabled .key-label {
    font-size: 3.2cqmin; /* INCREASED: larger labels even when disabled */
    font-weight: 500;
  }

  .key-app-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 65%;
    height: 65%;
    position: relative;
    z-index: 1;
    margin-top: 10%;
  }

  .key-app-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  :global(.key-app-icon-fallback) {
    width: 50%;
    height: 50%;
    color: var(--color-text-muted);
    opacity: 0.5;
  }
</style>
