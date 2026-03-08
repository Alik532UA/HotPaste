<script lang="ts">
  import type { Card } from "../types";
  import {
    getState,
    copyCard,
    saveCard,
    toggleStrikethrough,
  } from "../stores/appState.svelte";
  import * as icons from "lucide-svelte";
  import type { ComponentType } from "svelte";

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const appState = getState();

  const isFlashing = $derived(appState.flashingCardPath === card.filePath);
  const isFull = $derived(appState.cardView === "full");

  const lines = $derived(card.content.split("\n"));

  /** Edit state */
  let isEditing = $state(false);
  let editContent = $state("");

  // Initialize from the prop after mount to avoid the "state referenced locally" warning,
  // or simply use an effect to sync if it's a new mock card.
  $effect(() => {
    if ((card as any).isNewMock && !isEditing) {
      isEditing = true;
      editContent = card.content;
    }
  });

  /** Hover zone tracking for click interaction */
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
    return parts.length > 0 ? parts.join("; ") : undefined;
  }

  function handleAction() {
    copyCard(card);
  }

  function handleEditClick(e: MouseEvent) {
    e.stopPropagation();
    startEditing();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAction();
    }
  }

  function handleCardClick(e: MouseEvent) {
    // Left 50% = Strikethrough toggle, Right 50% = Action (Copy)
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isAction = x / rect.width > 0.5;

    if (isAction) {
      handleAction();
    } else {
      // Find which line was clicked
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
    const currentTarget = e.currentTarget as HTMLElement;
    const rect = currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    hoverZone = x / rect.width > 0.5 ? "action" : "strike";
  }

  function handleMouseLeave() {
    hoverZone = null;
  }

  function startEditing() {
    editContent = card.content;
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
    editContent = "";

    // If it was a mock card and user cancelled, it should be removed from the list
    if ((card as any).isNewMock) {
      // Find the active tab and remove this card
      const tab = appState.activeTab;
      if (tab) {
        tab.cards = tab.cards.filter((c) => c !== card);
      }
    }
  }

  async function handleSave() {
    await saveCard(card, editContent);
    isEditing = false;
    editContent = "";
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
</script>

{#if isEditing}
  <!-- Edit mode -->
  <div
    class="snippet-card editing"
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
    style={getCardStyle()}
  >
    <!-- Card header -->
    <div class="card-header">
      {#if LucideIcon}
        <span class="card-icon"><LucideIcon size={16} /></span>
      {:else if card.icon}
        <span class="card-icon emoji">{card.icon}</span>
      {/if}
      <h3 class="card-title">{card.name}</h3>
      <span class="card-ext">{card.extension}</span>
    </div>

    <!-- Textarea -->
    <div class="edit-area">
      <textarea
        class="edit-textarea"
        bind:value={editContent}
        onkeydown={handleEditKeydown}
      ></textarea>
    </div>

    <!-- Edit actions -->
    <div class="edit-actions">
      <span class="edit-hint">Ctrl+Enter — зберегти, Esc — скасувати</span>
      <div class="edit-buttons">
        <button class="edit-btn cancel" onclick={cancelEditing}
          >Скасувати</button
        >
        <button class="edit-btn save" onclick={handleSave}>Зберегти</button>
      </div>
    </div>
  </div>
{:else}
  <!-- Normal card -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- We handle a11y via hotkeys globally, interactive wrapper is fine for this specialized UI -->
  <div
    class="snippet-card interactive"
    class:flashing={isFlashing}
    class:hover-action={hoverZone === "action"}
    class:hover-strike={hoverZone === "strike"}
    onclick={handleCardClick}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    onkeydown={handleKeydown}
    tabindex="0"
    role="button"
    title={hoverZone === "action"
      ? `Скопіювати: ${card.name}`
      : "Закреслити рядок"}
    aria-label={`Копіювати сніпет: ${card.name}`}
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
    style={getCardStyle()}
  >
    <!-- Hotkey badge -->
    {#if card.hotkey}
      <div class="card-hotkey">{card.hotkey}</div>
    {/if}

    <!-- Action indicator (shows up on hover in the action zone) -->
    {#if hoverZone === "action"}
      <div class="action-overlay-hint">
        <icons.Copy size={32} opacity={0.15} />
      </div>
    {/if}

    <!-- Card header -->
    <div class="card-header">
      {#if LucideIcon}
        <span class="card-icon"><LucideIcon size={16} /></span>
      {:else if card.icon}
        <span class="card-icon emoji">{card.icon}</span>
      {/if}
      <h3 class="card-title">{card.name}</h3>
      <span class="card-ext">{card.extension}</span>
    </div>

    <!-- Card content lines -->
    <div class="card-content" class:full={isFull}>
      {#each lines as line, i}
        <div
          class="line"
          data-index={i}
          class:strikethrough={card.strikethrough.includes(i)}
        >
          {line || " "}
        </div>
      {/each}

      {#if !isFull}
        <div class="card-fade"></div>
      {/if}
    </div>

    <!-- Edit mode indicator / button -->
    <button
      class="edit-indicator"
      title="Редагувати картку"
      aria-label="Редагувати картку"
      onclick={handleEditClick}
    >
      <icons.Edit3 size={14} />
    </button>

    <!-- Copy indicator overlay -->
    {#if isFlashing}
      <div class="copy-overlay">
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
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  .snippet-card:focus-visible {
    border-color: var(--color-accent-cyan);
    box-shadow: 0 0 0 2px rgba(0, 210, 255, 0.3);
  }

  /* Hover states based on zone */
  .snippet-card.hover-action {
    cursor: pointer;
    border-color: var(--color-card-border, var(--color-accent-cyan));
    transform: translateY(-2px);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(0, 210, 255, 0.1);
  }

  .snippet-card.hover-strike {
    border-color: var(--color-card-border, var(--color-border-hover));
  }

  .snippet-card:active {
    transform: translateY(0);
  }

  .snippet-card.editing {
    border-color: var(--color-accent-violet);
    box-shadow: 0 0 20px rgba(123, 97, 255, 0.15);
  }

  .snippet-card.flashing {
    border-color: var(--color-accent-green);
    box-shadow:
      0 0 20px rgba(0, 255, 136, 0.2),
      0 0 0 2px rgba(0, 255, 136, 0.3);
    animation: flashPulse 0.4s ease;
  }

  @keyframes flashPulse {
    0% {
      box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.4);
    }
    50% {
      box-shadow:
        0 0 30px rgba(0, 255, 136, 0.3),
        0 0 0 3px rgba(0, 255, 136, 0.4);
    }
    100% {
      box-shadow:
        0 0 20px rgba(0, 255, 136, 0.2),
        0 0 0 2px rgba(0, 255, 136, 0.3);
    }
  }

  /* Hotkey badge */
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
    color: var(--color-accent-cyan);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1;
    opacity: 0.7;
    transition:
      opacity 0.2s ease,
      background 0.2s ease;
    z-index: 5;
  }

  .snippet-card.hover-action .card-hotkey {
    opacity: 1;
    background: var(--color-accent-gradient);
    color: var(--color-bg-primary);
  }

  /* Large action hint */
  .action-overlay-hint {
    position: absolute;
    left: 75%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2;
    color: var(--color-accent-cyan);
  }

  /* Card header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 8px;
    padding-right: 48px; /* space for hotkey badge */
    pointer-events: none; /* Let clicks pass through to the base */
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
    font-size: 0.65rem;
    color: var(--color-text-muted);
    background: var(--color-surface-3);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  /* Card content */
  .card-content {
    position: relative;
    padding: 0 16px 14px;
    max-height: 200px;
    overflow: hidden;
    pointer-events: auto; /* Re-enable pointer events for lines */
  }

  .card-content.full {
    max-height: none;
    overflow: visible;
  }

  /* Individual text lines */
  .line {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: 4px;
    padding: 0 4px;
    margin: 0 -4px; /* offset padding */
    transition:
      background 0.15s ease,
      opacity 0.2s ease;
  }

  .snippet-card.hover-strike .line:hover {
    background: var(--color-surface-3);
    cursor: pointer;
  }

  /* Strikethrough style */
  .line.strikethrough {
    text-decoration: line-through;
    opacity: 0.4;
    color: var(--color-text-muted);
  }

  /* Gradient fade for overflowing text */
  .card-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 48px;
    background: linear-gradient(to bottom, transparent, var(--color-card-bg));
    pointer-events: none;
    z-index: 5;
  }

  /* Edit button */
  .edit-indicator {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    opacity: 0;
    transition: all 0.2s ease;
    cursor: pointer;
    z-index: 10;
  }

  .snippet-card:hover .edit-indicator {
    opacity: 1;
  }

  .edit-indicator:hover {
    background: var(--color-accent-violet);
    color: white;
    transform: scale(1.05);
  }

  /* Edit area */
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

  /* Edit actions */
  .edit-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 14px;
    gap: 8px;
  }

  .edit-hint {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .edit-buttons {
    display: flex;
    gap: 6px;
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
    box-shadow: 0 4px 12px rgba(123, 97, 255, 0.3);
  }

  /* Copy overlay */
  .copy-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 255, 136, 0.08);
    animation: fadeIn 0.15s ease;
    pointer-events: none;
    z-index: 10;
  }

  .copy-icon {
    font-size: 2rem;
    color: var(--color-accent-green);
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
</style>
