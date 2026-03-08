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
  } from "../stores/appState.svelte";
  import { logService } from "../services/logService";
  import * as icons from "lucide-svelte";
  import type { ComponentType } from "svelte";

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const appState = getState();

  const isFlashing = $derived(appState.flashingCardPath === card.filePath);
  const isFull = $derived(appState.cardView === "full");
  const isMissing = $derived(card.isMissing);

  const lines = $derived(card.content.split("\n"));

  /** Edit state */
  let isEditing = $state(false);
  let isSaving = $state(false);
  let editContent = $state("");
  let textareaElement = $state<HTMLTextAreaElement | null>(null);

  /** Linking state (manual recovery) */
  let isLinking = $state(false);

  // Focus textarea when editing starts
  $effect(() => {
    if (isEditing && textareaElement) {
      textareaElement.focus();
    }
  });

  // Initialize from the prop after mount
  $effect(() => {
    if ((card as any).isNewMock && !isEditing) {
      logService.log('ui', `Auto-starting edit for NEW mock card: ${card.filePath}`);
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
    if (isMissing) parts.push(`--color-card-border: #ff4b4b`);
    return parts.length > 0 ? parts.join("; ") : undefined;
  }

  function handleAction() {
    if (isMissing || isEditing) return;
    copyCard(card);
  }

  function handleEditClick(e: MouseEvent) {
    e.stopPropagation();
    if (isMissing) return;
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
    if (isMissing || isEditing) return;
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isAction = x / rect.width > 0.2;

    if (isAction) {
      handleAction();
    } else {
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
    if (isMissing || isEditing) {
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
    logService.log('ui', `Starting edit: ${card.name} (${card.filePath})`);
    editContent = card.content;
    isEditing = true;
  }

  function cancelEditing() {
    logService.log('ui', `Cancelling edit: ${card.name}`);
    isEditing = false;
    editContent = "";
    if ((card as any).isNewMock) {
      const tab = appState.activeTab;
      if (tab) {
        logService.log('ui', `Removing discarded mock: ${card.filePath}`);
        tab.cards = tab.cards.filter((c) => c !== card);
      }
    }
  }

  async function handleSave() {
    if (isSaving) return;
    logService.log('ui', `Saving click for: ${card.name} (path: ${card.filePath})`);
    isSaving = true;
    try {
      await saveCard(card, editContent);
      logService.log('ui', `Save done for: ${card.name}`);
      isEditing = false;
      editContent = "";
    } catch (err) {
      logService.log('error', `Save failed: ${card.name}`, err);
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
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
    style={getCardStyle()}
    oncontextmenu={(e) => e.stopPropagation()}
    data-testid="card-editing"
  >
    <div class="card-header">
      {#if LucideIcon}
        <span class="card-icon"><LucideIcon size={16} /></span>
      {:else if card.icon}
        <span class="card-icon emoji">{card.icon}</span>
      {/if}
      <h3 class="card-title">{card.name}</h3>
      <span class="card-ext">{card.extension}</span>
    </div>

    <div class="edit-area">
      <textarea
        class="edit-textarea"
        bind:this={textareaElement}
        bind:value={editContent}
        onkeydown={handleEditKeydown}
        disabled={isSaving}
        data-testid="edit-textarea"
      ></textarea>
    </div>

    <div class="edit-actions">
      <span class="edit-hint">Ctrl+Enter — зберегти, Esc — скасувати</span>
      <div class="edit-buttons">
        <button class="edit-btn cancel" onclick={cancelEditing} disabled={isSaving} data-testid="btn-edit-cancel">Скасувати</button>
        <button class="edit-btn save" onclick={handleSave} disabled={isSaving} data-testid="btn-edit-save">
          {isSaving ? "Збереження..." : "Зберегти"}
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
    class:hover-action={hoverZone === "action" && !isMissing}
    class:hover-strike={hoverZone === "strike" && !isMissing}
    onclick={handleCardClick}
    oncontextmenu={handleContextMenu}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    onkeydown={handleKeydown}
    tabindex="0"
    role="button"
    title={isMissing ? "Файл не знайдено на диску" : (hoverZone === "action" ? `Скопіювати: ${card.name}` : "Закреслити рядок")}
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
    style={getCardStyle()}
    data-testid="snippet-card"
    data-card-name={card.name}
  >
    <!-- Hotkey badge -->
    {#if card.hotkey && !isMissing}
      <div class="card-hotkey" data-testid="card-hotkey">{appState.getHotkeyLabel(card.hotkey)}</div>
    {/if}

    <!-- Missing indicator icon -->
    {#if isMissing}
      <div class="missing-badge" data-testid="missing-badge">
        <icons.AlertTriangle size={12} />
        <span>ЗНИК</span>
      </div>
    {/if}

    <!-- Action indicator -->
    {#if hoverZone === "action" && !isMissing}
      <div class="action-overlay-hint" data-testid="action-hint">
        <icons.Copy size={32} opacity={0.15} />
      </div>
    {/if}

    <!-- Card header -->
    <div class="card-header">
      {#if isMissing}
        <span class="card-icon error"><icons.FileX size={16} /></span>
      {:else if LucideIcon}
        <span class="card-icon"><LucideIcon size={16} /></span>
      {:else if card.icon}
        <span class="card-icon emoji">{card.icon}</span>
      {/if}
      <h3 class="card-title">{card.name}</h3>
      {#if !isMissing}
        <span class="card-ext">{card.extension}</span>
      {/if}
    </div>

    {#if isMissing}
      <div class="missing-content">
        <p class="error-msg">Файл <code>{card.fileName}</code> не знайдено.</p>
        
        {#if isLinking}
          <div class="manual-link-area" data-testid="manual-link-area">
            <p>Прив'язати до файлу:</p>
            <div class="unrecognized-list">
              {#each appState.activeCards.filter(c => !c.isMissing) as realCard}
                <button class="link-option" onclick={() => performManualLink(realCard.fileName)} data-testid="link-option">
                  {realCard.fileName}
                </button>
              {/each}
              {#if appState.activeCards.filter(c => !c.isMissing).length === 0}
                <p class="hint">Файли відсутні</p>
              {/if}
            </div>
            <button class="btn-cancel-link" onclick={() => isLinking = false} data-testid="btn-cancel-link">Скасувати</button>
          </div>
        {:else}
          <div class="missing-actions">
            <button class="btn-ghost-action link" onclick={handleLinkManually} data-testid="btn-link-manually">
              <icons.Link size={14} />
              Знайти
            </button>
            <button class="btn-ghost-action delete" onclick={() => removeOrphanedConfig(card)} data-testid="btn-remove-config">
              <icons.Trash2 size={14} />
              Видалити
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Card content lines -->
      <div class="card-content-container">
        <div class="card-content" class:full={isFull} data-testid="card-content">
          {#each lines as line, i}
            <div
              class="line"
              data-index={i}
              class:strikethrough={card.strikethrough.includes(i)}
              data-testid="content-line"
            >
              {line || " "}
            </div>
          {/each}
        </div>

        {#if !isFull}
          <div class="card-fade"></div>
        {/if}
      </div>

      <!-- Card action buttons (bottom right) -->
      <div class="card-actions-overlay">
        <button
          class="action-overlay-btn more-btn"
          title="Більше дій"
          aria-label="Контекстне меню"
          onclick={handleMoreClick}
          data-testid="btn-card-more"
        >
          <icons.MoreVertical size={18} />
        </button>

        <button
          class="action-overlay-btn edit-btn"
          title="Редагувати текст"
          aria-label="Редагувати картку"
          onclick={handleEditClick}
          data-testid="btn-card-edit"
        >
          <icons.Edit3 size={18} />
        </button>
      </div>
    {/if}

    <!-- Copy indicator overlay -->
    {#if isFlashing}
      <div class="copy-overlay" data-testid="copy-indicator">
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
    overflow: hidden;
    break-inside: avoid;
    margin-bottom: var(--space-3);
    text-align: left;
    font-family: var(--font-family);
    width: 100%;
    color: var(--color-text-primary);
    outline: none;
  }

  .snippet-card.interactive {
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
  }

  .snippet-card.missing {
    background: rgba(255, 75, 75, 0.05);
    border-color: rgba(255, 75, 75, 0.3);
  }

  .snippet-card:focus-visible {
    border-color: var(--color-card-border, var(--color-accent-cyan));
    box-shadow: 0 0 0 2px rgba(0, 210, 255, 0.3);
  }

  /* Hover states */
  .snippet-card.hover-action {
    cursor: pointer;
    border-color: var(--color-card-border, var(--color-accent-cyan));
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 210, 255, 0.1);
  }

  .snippet-card.hover-strike {
    border-color: var(--color-card-border, var(--color-border-hover));
  }

  .snippet-card.editing {
    border-color: var(--color-accent-violet);
    box-shadow: 0 0 20px rgba(123, 97, 255, 0.15);
  }

  .snippet-card.flashing {
    border-color: var(--color-accent-green);
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.2), 0 0 0 2px rgba(0, 255, 136, 0.3);
    animation: flashPulse 0.4s ease;
  }

  @keyframes flashPulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.4); }
    50% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.3), 0 0 0 3px rgba(0, 255, 136, 0.4); }
    100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.2), 0 0 0 2px rgba(0, 255, 136, 0.3); }
  }

  .card-hotkey {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--color-surface-3);
    color: var(--color-card-border, var(--color-accent-cyan));
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1;
    opacity: 0.7;
    z-index: 5;
  }

  .missing-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #ff4b4b;
    color: white;
    border-radius: 6px;
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.5px;
    z-index: 5;
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
    padding: 14px 16px 8px;
    padding-right: 48px;
    pointer-events: none;
  }

  .card-icon { display: inline-flex; align-items: center; justify-content: center; color: var(--color-text-secondary); }
  .card-icon.emoji { font-size: 1.1rem; }
  .card-icon.error { color: #ff4b4b; }

  .card-title { margin: 0; font-size: 0.85rem; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .card-ext { font-size: 0.65rem; color: var(--color-text-muted); background: var(--color-surface-3); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); flex-shrink: 0; }

  .card-content-container { position: relative; display: flex; flex-direction: column; overflow: hidden; flex: 1; }
  .card-content { position: relative; padding: 0 16px 40px; max-height: 180px; overflow-y: auto; pointer-events: auto; scrollbar-width: thin; }
  .card-content::-webkit-scrollbar { width: 4px; }
  .card-content.full { max-height: none; overflow: visible; padding-bottom: 14px; }

  .line { font-family: var(--font-mono); font-size: 0.75rem; line-height: 1.6; color: var(--color-text-secondary); white-space: pre-wrap; word-break: break-word; border-radius: 4px; padding: 0 4px; margin: 0 -4px; transition: background 0.15s ease, opacity 0.2s ease; }
  .snippet-card.hover-strike .line:hover { background: var(--color-surface-3); cursor: pointer; }
  .line.strikethrough { text-decoration: line-through; opacity: 0.4; color: var(--color-text-muted); }

  .card-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 48px; background: linear-gradient(to bottom, transparent, var(--color-card-bg) 70%); pointer-events: none; z-index: 5; }

  .card-actions-overlay { position: absolute; bottom: 8px; right: 8px; display: flex; gap: 6px; opacity: 0; transform: translateY(4px); transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 10; }
  .snippet-card:hover .card-actions-overlay { opacity: 1; transform: translateY(0); }

  .action-overlay-btn { width: 32px; height: 32px; border-radius: 50%; background: var(--color-surface-2); border: 1px solid var(--color-border); color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; }
  .action-overlay-btn:hover { background: var(--color-surface-3); color: var(--color-text-primary); border-color: var(--color-border-hover); transform: scale(1.1); }
  .action-overlay-btn.edit-btn:hover { background: var(--color-accent-violet); color: white; border-color: transparent; }

  .missing-content { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }
  .error-msg { font-size: 0.75rem; color: var(--color-text-secondary); line-height: 1.4; margin: 0; }
  .error-msg code { background: rgba(255, 255, 255, 0.1); padding: 2px 4px; border-radius: 4px; color: #ff4b4b; }
  .missing-actions { display: flex; gap: 8px; }
  .btn-ghost-action { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface-2); color: var(--color-text-primary); font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
  .btn-ghost-action:hover { background: var(--color-surface-3); }
  .btn-ghost-action.delete:hover { background: rgba(255, 75, 75, 0.1); color: #ff4b4b; border-color: #ff4b4b; }

  .manual-link-area { display: flex; flex-direction: column; gap: 8px; background: var(--color-surface-2); padding: 10px; border-radius: 8px; }
  .manual-link-area p { font-size: 0.7rem; margin: 0; color: var(--color-text-muted); }
  .unrecognized-list { max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
  .link-option { text-align: left; padding: 6px 8px; background: var(--color-surface-3); border: 1px solid var(--color-border); border-radius: 4px; color: var(--color-text-secondary); font-size: 0.7rem; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .link-option:hover { background: var(--color-accent-violet); color: white; border-color: transparent; }
  .btn-cancel-link { background: transparent; border: none; color: var(--color-text-muted); font-size: 0.7rem; cursor: pointer; margin-top: 4px; }

  .edit-area { padding: 0 16px; }
  .edit-textarea { width: 100%; min-height: 150px; max-height: 400px; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-primary); color: var(--color-text-primary); font-family: var(--font-mono); font-size: 0.8rem; line-height: 1.6; resize: vertical; outline: none; transition: border-color 0.2s ease; }
  .edit-textarea:focus { border-color: var(--color-accent-violet); }
  .edit-actions { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 14px; gap: 8px; }
  .edit-hint { font-size: 0.7rem; color: var(--color-text-muted); font-family: var(--font-mono); }
  .edit-buttons { display: flex; gap: 6px; }
  .edit-btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 8px; font-family: var(--font-family); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
  .edit-btn.cancel { background: transparent; color: var(--color-text-muted); }
  .edit-btn.cancel:hover { background: var(--color-surface-2); color: var(--color-text-primary); }
  .edit-btn.save { background: var(--color-accent-violet); color: #fff; border-color: var(--color-accent-violet); }
  .edit-btn.save:hover { opacity: 0.9; box-shadow: 0 4px 12px rgba(123, 97, 255, 0.3); }
  .edit-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(0.5); }

  .copy-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 255, 136, 0.08); animation: fadeIn 0.15s ease; pointer-events: none; z-index: 10; }
  .copy-icon { font-size: 2rem; color: var(--color-accent-green); animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
