<script lang="ts">
  import type { Card } from "../types";
  import {
    getState,
    copyCard,
    saveCard,
    toggleStrikethrough,
    openContextMenu,
    removeOrphanedConfig,
    linkFileManually,
    startEditingCard,
    stopEditingCard,
    openHotkeyPicker,
    toggleCardSelection,
  } from "../stores/appState.svelte";
  import { logService } from "../services/logService.svelte";
  import { Edit3, Menu, Copy, FileX, Keyboard, Link, Trash2, Check, Maximize2, Minimize2, GripVertical } from "lucide-svelte";
  import * as icons from "lucide-svelte";
  import type { ComponentType } from "svelte";
  import { renderMarkdown } from "../utils/markdown";
  import { sanitize } from "../utils/sanitizer";
  import { t } from "../i18n";
  import TextHighlight from "./ui/TextHighlight.svelte";

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const appState = getState();

  const isFlashing = $derived(appState.flashingCardPath === card.filePath);
  const isFull = $derived(appState.cardView === "full");
  const isCompact = $derived(appState.cardDensity === "compact");
  const isExpanded = $derived(appState.cardDensity === "expanded");
  const isMissing = $derived(card.isMissing);
  const isSelected = $derived(appState.selectedCardIds.has(card.id));
  const isSelectionMode = $derived(appState.isSelectionMode);

  const lines = $derived(card.content.split("\n"));

  /** Markdown rendering state */
  let renderedMarkdown = $state("");

  $effect(() => {
    if (card.extension === ".md") {
      renderMarkdown(card.content).then((html) => {
        renderedMarkdown = sanitize(html);
      });
    }
  });

  /** Edit state */
  let isEditing = $state(false);
  let isSaving = $state(false);
  let editContent = $state("");
  let textareaElement = $state<HTMLTextAreaElement | null>(null);
  let contentElement = $state<HTMLDivElement | null>(null);
  let isOverflowing = $state(false);
  let scrollPercentage = $state(0);
  let thumbHeightPercentage = $state(0);

  /** Linking state (manual recovery) */
  let isLinking = $state(false);

  /** Full-screen editor mode */
  let isMaximized = $state(false);

  // Sync global editing state
  $effect(() => {
    const globalPath = appState.editingCardPath;
    if (globalPath === card.filePath && !isEditing) {
      logService.log(
        "ui",
        `Effect: starting local edit for ${card.name} because global path matches`,
      );
      startEditing();
    } else if (globalPath !== card.filePath && isEditing) {
      // If global state changed to something else, cancel local edit
      // (Unless it's a new mock, which we handle separately)
      if (!(card as any).isNewMock) {
        logService.log(
          "ui",
          `Effect: cancelling local edit for ${card.name} because global path changed to: ${globalPath}`,
        );
        isEditing = false;
        editContent = "";
      }
    }
  });

  // Focus textarea when editing starts
  $effect(() => {
    if (isEditing && textareaElement) {
      textareaElement.focus();
    }
  });

  // Check for overflow and sync scroll position
  $effect(() => {
    if (!contentElement || isFull) {
      isOverflowing = false;
      return;
    }

    const updateScrollMetrics = () => {
      if (contentElement) {
        const { scrollTop, scrollHeight, clientHeight } = contentElement;
        isOverflowing = scrollHeight > clientHeight;

        if (isOverflowing) {
          scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
          thumbHeightPercentage = (clientHeight / scrollHeight) * 100;
        }
      }
    };

    updateScrollMetrics();

    const handleScroll = () => updateScrollMetrics();
    contentElement.addEventListener("scroll", handleScroll, { passive: true });

    const observer = new ResizeObserver(updateScrollMetrics);
    observer.observe(contentElement);

    return () => {
      contentElement?.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  });

  // Initialize from the prop after mount
  $effect(() => {
    if ((card as any).isNewMock && !isEditing) {
      logService.log(
        "ui",
        `Auto-starting edit for NEW mock card: ${card.filePath}`,
      );
      startEditing();
    }
  });

  /** Hover zone tracking */
  let hoverZone = $state<"action" | "strike" | null>(null);

  /** Dynamic Lucide icon resolution */
  const LucideIcon = $derived(
    card.icon && card.icon.length > 2
      ? (icons[card.icon as keyof typeof icons] as ComponentType | undefined)
      : null,
  );

  function getCardStyle() {
    const parts = [];
    if (card.color) parts.push(`--color-card-bg: ${card.color}`);
    if (card.borderColor)
      parts.push(`--color-card-border: ${card.borderColor}`);
    if (isMissing) parts.push(`--color-card-border: var(--color-danger)`);
    return parts.length > 0 ? parts.join("; ") : undefined;
  }

  function handleAction() {
    if (isMissing || isEditing) return;
    copyCard(card);
  }

  function handleEditClick(e: MouseEvent) {
    logService.log("ui", `handleEditClick for card: ${card.name}`);
    e.stopPropagation();
    if (isMissing) {
      logService.log("ui", "handleEditClick blocked: card is missing");
      return;
    }
    startEditing();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isEditing) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAction();
    }
  }

  function handleCardClick(e: MouseEvent) {
    logService.log(
      "ui",
      `handleCardClick for card: ${card.name}, isEditing: ${isEditing}`,
    );
    if (isMissing || isEditing) return;

    // Selection mode (global, Ctrl, or Shift)
    if (isSelectionMode || e.ctrlKey || e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleCardSelection(card.id);
      return;
    }

    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isAction = x / rect.width > 0.2;

    if (isAction) {
      logService.log("ui", "handleCardClick: triggered copy action");
      handleAction();
    } else {
      logService.log(
        "ui",
        "handleCardClick: triggered line strikethrough check",
      );
      const target = e.target as HTMLElement;
      const lineEl = target.closest(".line");
      if (lineEl) {
        const indexStr = lineEl.getAttribute("data-index");
        if (indexStr) {
          const index = parseInt(indexStr, 10);
          toggleStrikethrough(card, index);
        }
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isMissing || isEditing || isSelectionMode) {
      hoverZone = null;
      return;
    }
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    hoverZone = x / rect.width > 0.2 ? "action" : "strike";
  }

  function handleMouseLeave() {
    hoverZone = null;
  }

  function startEditing() {
    logService.log(
      "ui",
      `Starting edit (local): ${card.name} (${card.filePath})`,
    );
    editContent = card.content;
    isEditing = true;
    startEditingCard(card); // Sync to global state
  }

  function cancelEditing() {
    logService.log("ui", `Cancelling edit (local): ${card.name}`);
    isEditing = false;
    editContent = "";
    stopEditingCard(); // Sync to global state

    if ((card as any).isNewMock) {
      const tab = appState.activeTab;
      if (tab) {
        logService.log("ui", `Removing discarded mock: ${card.filePath}`);
        tab.cards = tab.cards.filter((c) => c !== card);
      }
    }
  }

  async function handleSave() {
    if (isSaving) return;
    logService.log(
      "ui",
      `handleSave for: ${card.name} (path: ${card.filePath})`,
    );
    isSaving = true;
    try {
      await saveCard(card, editContent);
      logService.log("ui", `Save done (local): ${card.name}`);
      isEditing = false;
      editContent = "";
      stopEditingCard(); // Sync to global state
    } catch (err) {
      logService.log("error", `Save failed: ${card.name}`, err);
    } finally {
      isSaving = false;
    }
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    } else if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isMissing || isEditing) return;
    openContextMenu(e.clientX, e.clientY, card);
  }

  function handleMoreClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(rect.left, rect.bottom + 5, card);
  }

  function handleLinkManually() {
    isLinking = true;
  }

  function performManualLink(fileName: string) {
    linkFileManually(card, fileName);
    isLinking = false;
  }
</script>

{#if isEditing}
  <!-- Edit mode -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="snippet-card editing"
    class:maximized={isMaximized}
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
    style={getCardStyle()}
    oncontextmenu={(e) => e.stopPropagation()}
    data-testid={isMaximized ? "card-editing-maximized" : "card-editing-standard"}
  >
    <div class="card-header" data-testid="card-header">
      {#if LucideIcon}
        <span class="card-icon"><LucideIcon size={16} /></span>
      {:else if card.icon}
        <span class="card-icon emoji">{card.icon}</span>
      {/if}
      <h3 class="card-title" data-testid="card-title">{card.name}</h3>
      <div class="edit-header-actions" data-testid="edit-header-actions">
        <span class="card-ext" data-testid="card-extension">{card.extension}</span>
        <button 
          class="icon-btn-toggle" 
          onclick={() => isMaximized = !isMaximized}
          title={isMaximized ? "Minimize" : "Maximize"}
          data-testid="btn-edit-toggle-maximize"
        >
          {#if isMaximized}
            <Minimize2 size={16} />
          {:else}
            <Maximize2 size={16} />
          {/if}
        </button>
      </div>
    </div>

    <div class="edit-area" data-testid="edit-area">
      <textarea
        class="edit-textarea"
        bind:this={textareaElement}
        bind:value={editContent}
        onkeydown={(e) => {
          e.stopPropagation(); // Prevent global hotkeys while typing
          handleEditKeydown(e);
        }}
        disabled={isSaving}
        data-testid="edit-textarea"
      ></textarea>
    </div>

    <div
      class="edit-actions"
      role="presentation"
      onclick={(e) => e.stopPropagation()}
      data-testid="edit-actions"
    >
      <span class="edit-hint" data-testid="edit-hint">{t.cards.hint}</span>
      <div class="edit-buttons" data-testid="edit-buttons">
        <button
          class="edit-btn cancel"
          onclick={(e) => {
            e.stopPropagation();
            cancelEditing();
          }}
          disabled={isSaving}
          data-testid="btn-edit-cancel">{t.common.cancel}</button
        >
        <button
          class="edit-btn save"
          onclick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          disabled={isSaving}
          data-testid="btn-edit-save"
        >
          {isSaving ? t.common.loading : t.common.save}
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Normal card or Ghost Card -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="snippet-card interactive"
    class:flashing={isFlashing}
    class:missing={isMissing}
    class:compact={isCompact}
    class:selected={isSelected}
    class:selection-mode={isSelectionMode}
    class:hover-action={hoverZone === "action" && !isMissing && !isSelectionMode}
    class:hover-strike={hoverZone === "strike" && !isMissing && !isSelectionMode}
    onclick={handleCardClick}
    oncontextmenu={handleContextMenu}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    onkeydown={handleKeydown}
    tabindex="0"
    role="button"
    title={isMissing
      ? "File not found"
      : isSelectionMode
        ? (isSelected ? "Deselect" : "Select")
        : hoverZone === "action"
          ? `${t.common.copy}: ${card.name}`
          : "Strike out line"}
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
    style={getCardStyle()}
    data-testid={`snippet-card-${card.id}`}
    data-card-name={card.name}
  >
    <!-- Visual Strike Zone Indicator -->
    {#if !isMissing && !isSelectionMode && !isEditing}
      <div 
        class="strike-zone-indicator" 
        class:visible={hoverZone === "strike"}
        data-testid={`strike-zone-${card.id}`}
      ></div>
    {/if}

    <!-- Selection Checkbox -->
    {#if isSelectionMode || isSelected}
      <button 
        class="selection-checkbox" 
        class:checked={isSelected}
        class:always-visible={isSelectionMode}
        onclick={(e) => {
          e.stopPropagation();
          toggleCardSelection(card.id);
        }}
        aria-label={isSelected ? "Deselect card" : "Select card"}
        title={isSelected ? "Deselect" : "Select"}
        data-testid={`selection-checkbox-${card.id}`}
      >
        {#if isSelected}
          <Check size={14} strokeWidth={3} />
        {/if}
      </button>
    {/if}

    <!-- Action indicator -->
    {#if hoverZone === "action" && !isMissing && !isSelectionMode}
      <div class="action-overlay-hint" data-testid={`action-hint-${card.id}`}>
        <icons.Copy size={32} opacity={0.15} />
      </div>
    {/if}

    <!-- Card header -->
    {#if !isCompact}
      <div class="card-header" data-testid={`card-header-${card.id}`}>
        <div class="drag-handle" title="Перетягнути картку">
          <GripVertical size={14} />
        </div>
        {#if isMissing}
          <span class="card-icon error"><icons.FileX size={16} /></span>
        {:else if LucideIcon}
          <span class="card-icon"><LucideIcon size={16} /></span>
        {:else if card.icon}
          <span class="card-icon emoji">{card.icon}</span>
        {/if}
        <h3 class="card-title" data-testid={`card-title-${card.id}`}>
          <TextHighlight text={card.name} query={appState.searchQuery} />
        </h3>
        {#if isExpanded && !isMissing}
          <span class="card-ext" data-testid={`card-extension-${card.id}`}
            >{card.extension}</span
          >
        {/if}

        <!-- Card action buttons (in header) -->
        <div
          class="card-actions-overlay"
          class:always-visible={isExpanded}
          data-testid={`card-actions-overlay-${card.id}`}
        >
          <button
            class="action-overlay-btn more-btn"
            title={t.common.settings}
            aria-label={t.common.settings}
            onclick={handleMoreClick}
            data-testid={`btn-card-more-${card.id}`}
          >
            <icons.Menu size={18} />
          </button>

          <button
            class="action-overlay-btn edit-btn"
            title={t.common.edit}
            aria-label={t.common.edit}
            onclick={handleEditClick}
            data-testid={`btn-card-edit-${card.id}`}
          >
            <icons.Edit3 size={18} />
          </button>
        </div>

        <!-- Hotkey (inside header) -->
        <button
          class="card-hotkey"
          class:conflict={card.isHotkeyConflicting}
          class:custom={card.isCustomHotkey && card.hotkey}
          class:disabled={card.isCustomHotkey && !card.hotkey}
          class:auto={!card.isCustomHotkey}
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            logService.log(
              "ui",
              `HOTKEY BUTTON CLICKED (STOPPED) for ${card.name}`,
            );
            openHotkeyPicker(card);
          }}
          aria-label="Change hotkey"
          title={card.isCustomHotkey && card.hotkey
            ? t.cards.hotkeyFixed
            : card.isCustomHotkey
              ? t.cards.hotkeyDisabled
              : t.cards.hotkeyChange}
          data-testid={`card-hotkey-${card.id}`}
        >
          {#if card.hotkey}
            {appState.getHotkeyLabel(card.hotkey)}
          {:else}
            <Keyboard size={14} />
          {/if}
        </button>
      </div>
    {:else}
      <!-- Hotkey badge (absolute position for compact mode) -->
      <button
        class="card-hotkey absolute"
        class:conflict={card.isHotkeyConflicting}
        class:custom={card.isCustomHotkey && card.hotkey}
        class:disabled={card.isCustomHotkey && !card.hotkey}
        class:auto={!card.isCustomHotkey}
        onclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          logService.log(
            "ui",
            `HOTKEY BUTTON CLICKED COMPACT (STOPPED) for ${card.name}`,
          );
          openHotkeyPicker(card);
        }}
        aria-label="Change hotkey"
        title={card.isCustomHotkey && card.hotkey
          ? t.cards.hotkeyFixed
          : card.isCustomHotkey
            ? t.cards.hotkeyDisabled
            : t.cards.hotkeyChange}
        data-testid={`card-hotkey-${card.id}`}
      >
        {#if card.hotkey}
          {appState.getHotkeyLabel(card.hotkey)}
        {:else}
          <Keyboard size={14} />
        {/if}
      </button>
    {/if}

    {#if isMissing}
      <div class="missing-content">
        <p class="error-msg">File <code>{card.fileName}</code> not found.</p>

        {#if isLinking}
          <div class="manual-link-area" data-testid={`manual-link-area-${card.id}`}>
            <p>Link to file:</p>
            <div class="unrecognized-list">
              {#each appState.activeCards.filter((c) => !c.isMissing) as realCard}
                <button
                  class="link-option"
                  onclick={() => performManualLink(realCard.fileName)}
                  data-testid={`link-option-${card.id}-${realCard.id}`}
                >
                  {realCard.fileName}
                </button>
              {/each}
              {#if appState.activeCards.filter((c) => !c.isMissing).length === 0}
                <p class="hint">No files</p>
              {/if}
            </div>
            <button
              class="btn-cancel-link"
              onclick={() => (isLinking = false)}
              data-testid={`btn-cancel-link-${card.id}`}>{t.common.cancel}</button
            >
          </div>
        {:else}
          <div class="missing-actions">
            <button
              class="btn-ghost-action link"
              onclick={handleLinkManually}
              data-testid={`btn-link-manually-${card.id}`}
              aria-label="Find and link file"
            >
              <icons.Link size={14} />
              Find
            </button>
            <button
              class="btn-ghost-action delete"
              onclick={() => removeOrphanedConfig(card)}
              data-testid={`btn-remove-config-${card.id}`}
              aria-label="Delete card config"
            >
              <icons.Trash2 size={14} />
              {t.common.delete}
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Card content lines -->
      <div class="card-content-container">
        <div
          class="card-content"
          class:full={isFull}
          class:markdown={card.extension === ".md"}
          bind:this={contentElement}
          data-testid={`card-content-${card.id}`}
        >
          {#if card.extension === ".md"}
            <div class="markdown-body">
              {@html renderedMarkdown}
            </div>
          {:else}
            {#each lines as line, i}
              <div
                class="line"
                data-index={i}
                class:strikethrough={card.strikethrough.includes(i)}
                data-testid={`content-line-${card.id}-${i}`}
              >
                <TextHighlight text={line || " "} query={appState.searchQuery} />
              </div>
            {/each}
          {/if}
        </div>

        {#if !isFull && isOverflowing}
          <div class="card-fade"></div>

          <!-- Custom Scrollbar Thumb -->
          <div class="custom-scrollbar-track">
            <div
              class="custom-scrollbar-thumb"
              style="height: {thumbHeightPercentage}%; top: {scrollPercentage *
                (1 - thumbHeightPercentage / 100)}%;"
            ></div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Copy indicator overlay -->
    {#if isFlashing}
      <div class="copy-overlay" data-testid={`copy-indicator-${card.id}`}>
        <span class="copy-icon">✓</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .snippet-card {
    --card-border-default: var(--color-border);
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 1px solid var(--color-card-border, var(--card-border-default));
    border-radius: 14px;
    background: var(--color-card-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.2s ease;
    /* overflow: hidden; Removed to prevent hotkey clipping */
    break-inside: avoid;
    margin-bottom: var(--space-3);
    text-align: left;
    font-family: var(--font-family);
    width: 100%;
    color: var(--color-text-primary);
    outline: none;
  }

  .snippet-card.compact {
    padding-top: 0;
  }

  .snippet-card.compact .card-content {
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .snippet-card.interactive {
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }

  .snippet-card.missing {
    background: color-mix(in srgb, var(--color-danger) 5%, transparent);
    border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
  }

  .snippet-card:focus-visible {
    border-color: var(--color-card-border, var(--color-accent-cyan));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
  }

  /* Hover states */
  .snippet-card.hover-action {
    cursor: pointer;
    border-color: var(--color-card-border, var(--color-accent-cyan));
    box-shadow:
      var(--shadow-lg),
      0 0 0 1px color-mix(in srgb, var(--color-accent-cyan) 10%, transparent);
  }

  .snippet-card.hover-strike {
    border-color: var(--color-card-border, var(--color-border-hover));
  }

  .snippet-card:focus-visible {
    outline: 2px solid var(--color-accent-cyan);
    outline-offset: 4px;
    border-color: var(--color-accent-cyan);
  }

  .snippet-card.editing {
    border-color: var(--color-accent-violet);
    box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent-violet) 15%, transparent);
  }

  .snippet-card.editing.maximized {
    position: fixed;
    top: 5vh;
    left: 5vw;
    width: 90vw;
    height: 90vh;
    z-index: 3000;
    background: var(--color-bg-secondary);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
  }

  .snippet-card.editing.maximized .edit-area {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .snippet-card.editing.maximized .edit-textarea {
    flex: 1;
    max-height: none;
  }

  .edit-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    pointer-events: auto;
  }

  .icon-btn-toggle {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .icon-btn-toggle:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
  }

  .snippet-card.selected {
    border-color: var(--color-accent-cyan) !important;
    background: color-mix(in srgb, var(--color-accent-cyan) 5%, transparent);
    box-shadow: 0 0 15px color-mix(in srgb, var(--color-accent-cyan) 20%, transparent);
  }

  .selection-checkbox {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid var(--color-border);
    background: var(--color-surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 20;
    padding: 0;
    color: white;
    transition: all 0.2s;
  }

  .selection-checkbox.checked {
    background: var(--color-accent-cyan);
    border-color: var(--color-accent-cyan);
  }

  .selection-checkbox:hover {
    transform: scale(1.1);
    border-color: var(--color-accent-cyan);
  }

  /* Shift header content if checkbox is visible or in selection mode */
  .selection-mode .card-header,
  .snippet-card.selected .card-header {
    padding-left: 40px;
  }

  .snippet-card.compact.selection-mode .card-content,
  .snippet-card.compact.selected .card-content {
    padding-left: 24px;
  }

  .snippet-card.flashing {
    border-color: var(--color-success);
    box-shadow:
      0 0 20px color-mix(in srgb, var(--color-success) 20%, transparent),
      0 0 0 2px color-mix(in srgb, var(--color-success) 30%, transparent);
    animation: flashPulse 0.4s ease;
  }

  @keyframes flashPulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 40%, transparent);
    }
    50% {
      box-shadow:
        0 0 30px color-mix(in srgb, var(--color-success) 30%, transparent),
        0 0 0 3px color-mix(in srgb, var(--color-success) 40%, transparent);
    }
    100% {
      box-shadow:
        0 0 20px color-mix(in srgb, var(--color-success) 20%, transparent),
        0 0 0 2px color-mix(in srgb, var(--color-success) 30%, transparent);
    }
  }

  .card-hotkey {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px; /* Slightly larger */
    height: 34px;
    border-radius: 9px;
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1;
    z-index: 10;
    flex-shrink: 0;
    pointer-events: auto;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    box-sizing: border-box;
    box-shadow: var(--shadow-sm); /* Added subtle shadow for depth */
  }

  /* 1. Auto (gemini.txt) - Clean button look */
  .card-hotkey.auto {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }

  /* 2. Disabled (npm_run_dev.txt) - Ghost but visible button */
  .card-hotkey.disabled {
    opacity: 0.5;
    background: transparent;
    border: 1px dashed var(--color-border);
    color: var(--color-text-muted);
    box-shadow: none;
  }

  /* 3. Custom Fixed (npm_run_check.txt) - Highlighted button */
  .card-hotkey.custom {
    border: 1px solid var(--color-accent-cyan);
    background: color-mix(in srgb, var(--color-accent-cyan) 20%, var(--color-surface-2));
    color: var(--color-accent-cyan);
    font-weight: 800;
  }

  .card-hotkey:hover {
    background: var(--color-accent-cyan);
    border-color: var(--color-accent-cyan);
    color: var(--color-bg-primary); /* High contrast text on hover */
    transform: scale(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-cyan) 30%, transparent);
  }

  .card-hotkey.conflict {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger);
    border-color: var(--color-danger);
    opacity: 1;
    animation: hotkeyShake 0.5s ease-in-out infinite alternate;
  }

  @keyframes hotkeyShake {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(2px);
    }
  }

  .card-hotkey.absolute {
    position: absolute;
    top: 3px;
    right: 4px;
    border-radius: 10px;
  }

  .action-overlay-hint {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 2;
    color: var(--color-accent-cyan);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px 0;
    pointer-events: none;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 2px;
    color: var(--color-text-muted);
    cursor: grab;
    pointer-events: auto;
    opacity: 0;
    transition: all 0.2s ease;
    margin-left: -8px;
    user-select: auto !important;
    -webkit-user-select: auto !important;
  }

  .snippet-card:hover .drag-handle {
    opacity: 0.5;
  }

  .drag-handle:hover {
    opacity: 1 !important;
    color: var(--color-accent-cyan);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  :global(.card-wrapper.dragging) {
    opacity: 0.4;
    transform: scale(0.95);
  }

  :global(.card-wrapper.drag-over) {
    /* No transform needed for live DND as elements move with flip */
    filter: brightness(1.1);
  }

  .card-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
  }
  .card-icon.emoji {
    font-size: 1.1rem;
  }
  .card-icon.error {
    color: var(--color-danger);
  }

  .card-title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .card-ext {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 8px;
    font-size: 0.65rem;
    color: var(--color-text-muted);
    background: var(--color-surface-3);
    border-radius: 8px;
    font-family: var(--font-mono);
    flex-shrink: 0;
    border: 1px solid var(--color-border);
  }

  .card-content-container {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    /* Ensure scrollbar pushed by negative margin is visible */
    overflow: visible;
  }
  .card-content {
    position: relative;
    padding: 8px 0;
    max-height: 180px;
    overflow-y: auto;
    overflow-x: hidden;
    pointer-events: auto;

    /* Hide native scrollbar but keep functionality */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    overscroll-behavior: contain; /* Prevent double scroll / scroll chaining */
  }
  .card-content.full {
    max-height: none;
    overflow-y: visible;
  }

  /* Webkit (Chrome, Edge, Safari) hide native scrollbar */
  .card-content::-webkit-scrollbar {
    display: none;
  }

  /* Custom Scrollbar Styles */
  .custom-scrollbar-track {
    position: absolute;
    right: -2.4px; /* Positioned at the very edge of the card */
    top: 8px;
    bottom: 8px;
    width: 4px;
    pointer-events: none;
    z-index: 20;
  }
  .custom-scrollbar-thumb {
    position: absolute;
    left: 0;
    width: 100%;
    background: var(--color-surface-3);
    border-radius: 10px;
    transition:
      background 0.2s ease,
      opacity 0.3s ease;
  }
  .snippet-card:hover .custom-scrollbar-thumb {
    background: var(--color-text-muted);
  }

  .line {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: 4px;
    padding: 0 16px;
    transition:
      background 0.15s ease,
      opacity 0.2s ease;
  }
  .snippet-card.hover-strike .line:hover {
    background: var(--color-surface-3);
    cursor: pointer;
  }

  .line.strikethrough {
    text-decoration: line-through;
    opacity: 0.4;
    color: var(--color-text-muted);
  }

  /* Markdown Styles */
  .card-content.markdown {
    padding: 12px 16px;
  }
  .markdown-body {
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--color-text-primary);
  }
  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3) {
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 700;
    line-height: 1.25;
    color: var(--color-text-primary);
  }
  .markdown-body :global(h1) {
    font-size: 1.25rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 4px;
  }
  .markdown-body :global(h2) {
    font-size: 1.1rem;
  }
  .markdown-body :global(h3) {
    font-size: 1rem;
  }

  .markdown-body :global(p) {
    margin-bottom: 12px;
  }

  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 20px;
    margin-bottom: 12px;
  }

  .markdown-body :global(li) {
    margin-bottom: 4px;
  }

  .markdown-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    background: var(--color-surface-3);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--color-accent-cyan);
  }

  .markdown-body :global(pre) {
    background: var(--color-surface-3);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 12px;
    border: 1px solid var(--color-border);
  }
  .markdown-body :global(pre code) {
    background: transparent;
    padding: 0;
    color: var(--color-text-secondary);
  }

  .markdown-body :global(blockquote) {
    border-left: 4px solid var(--color-accent-violet);
    padding-left: 12px;
    color: var(--color-text-muted);
    margin-bottom: 12px;
    font-style: italic;
  }

  .markdown-body :global(a) {
    color: var(--color-accent-cyan);
    text-decoration: none;
    pointer-events: auto;
  }
  .markdown-body :global(a:hover) {
    text-decoration: underline;
  }

  .card-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 48px;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--color-card-bg) 70%
    );
    pointer-events: none;
    z-index: 5;
    border-bottom-left-radius: 13px;
    border-bottom-right-radius: 13px;
  }

  .card-actions-overlay {
    display: flex;
    flex-direction: row;
    gap: 4px;
    margin-left: 8px;
    opacity: 0;
    transition: all 0.2s ease;
    z-index: 10;
    pointer-events: auto; /* Enable clicks on buttons inside header */
  }
  .snippet-card:hover .card-actions-overlay,
  .card-actions-overlay.always-visible {
    opacity: 1;
  }

  .action-overlay-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    pointer-events: auto; /* Just in case */
  }
  .action-overlay-btn:hover {
    background: var(--color-surface-3);
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
    transform: scale(1.1);
  }
  .action-overlay-btn :global(svg) {
    flex-shrink: 0;
    min-width: 18px;
    min-height: 18px;
  }

  .missing-content {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .error-msg {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
    margin: 0;
  }
  .error-msg code {
    background: var(--color-surface-1);
    padding: 2px 4px;
    border-radius: 4px;
    color: var(--color-danger);
  }
  .missing-actions {
    display: flex;
    gap: 8px;
  }
  .btn-ghost-action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-2);
    color: var(--color-text-primary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-ghost-action:hover {
    background: var(--color-surface-3);
  }
  .btn-ghost-action.delete:hover {
    background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .manual-link-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--color-surface-2);
    padding: 10px;
    border-radius: 8px;
  }
  .manual-link-area p {
    font-size: 0.7rem;
    margin: 0;
    color: var(--color-text-muted);
  }
  .unrecognized-list {
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .link-option {
    text-align: left;
    padding: 6px 8px;
    background: var(--color-surface-3);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    color: var(--color-text-secondary);
    font-size: 0.7rem;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .link-option:hover {
    background: var(--color-accent-violet);
    color: white;
    border-color: transparent;
  }
  .btn-cancel-link {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    cursor: pointer;
    margin-top: 4px;
  }

  .edit-area {
    padding: 0 16px;
  }
  .edit-textarea {
    width: 100%;
    min-height: 150px;
    max-height: 400px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    line-height: 1.6;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s ease;
  }
  .edit-textarea:focus {
    border-color: var(--color-accent-violet);
  }
  .edit-actions {
    display: flex;
    flex-direction: column; /* Hint above buttons by default */
    align-items: flex-start;
    padding: 10px 16px 14px;
    gap: 12px;
  }

  .editing.maximized .edit-actions {
    flex-direction: row; /* Horizontal for maximized mode */
    align-items: center;
    justify-content: space-between;
  }

  .edit-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .edit-buttons {
    display: flex;
    gap: 6px;
    width: 100%;
    justify-content: flex-end; /* Buttons to the right */
  }

  .editing.maximized .edit-buttons {
    width: auto;
  }
  .edit-btn {
    padding: 6px 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-family: var(--font-family);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .edit-btn.cancel {
    background: transparent;
    color: var(--color-text-muted);
  }
  .edit-btn.cancel:hover {
    background: var(--color-surface-2);
    color: var(--color-text-primary);
  }
  .edit-btn.save {
    background: var(--color-accent-violet);
    color: #fff;
    border-color: var(--color-accent-violet);
  }
  .edit-btn.save:hover {
    opacity: 0.9;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent-violet) 30%, transparent);
  }
  .edit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  .copy-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    animation: fadeIn 0.15s ease;
    pointer-events: none;
    z-index: 10;
  }
  .copy-icon {
    font-size: 2rem;
    color: var(--color-success);
    animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes scaleIn {
    from {
      transform: scale(0.5);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .strike-zone-indicator {
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    background: var(--color-accent-cyan);
    border-radius: 0 4px 4px 0;
    opacity: 0;
    transition: all 0.2s ease;
    z-index: 5;
    pointer-events: none;
  }

  .strike-zone-indicator.visible {
    opacity: 0.6;
    transform: translateX(0);
  }
</style>
