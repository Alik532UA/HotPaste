<script lang="ts">
  import type { Card } from "../types";
  import { getState, copyCard, saveCard } from "../stores/appState.svelte";

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const appState = getState();

  const isFlashing = $derived(appState.flashingCardPath === card.filePath);
  const isFull = $derived(appState.cardView === "full");
  const isEditMode = $derived(appState.appMode === "edit");

  /** Edit state */
  let isEditing = $state(false);
  let editContent = $state("");

  function handleClick() {
    if (isEditMode) {
      startEditing();
    } else {
      copyCard(card);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  function startEditing() {
    editContent = card.content;
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
    editContent = "";
  }

  async function handleSave() {
    await saveCard(card, editContent);
    isEditing = false;
    editContent = "";
  }

  function handleEditKeydown(e: KeyboardEvent) {
    // Ctrl+Enter to save, Escape to cancel
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
  >
    <!-- Card header -->
    <div class="card-header">
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
  <button
    class="snippet-card"
    class:flashing={isFlashing}
    class:edit-mode={isEditMode}
    onclick={handleClick}
    onkeydown={handleKeydown}
    title={isEditMode
      ? `Натисніть, щоб редагувати: ${card.name}`
      : `Натисніть '${card.hotkey}' або клікніть, щоб скопіювати`}
    aria-label={isEditMode
      ? `Редагувати сніпет: ${card.name}`
      : `Скопіювати сніпет: ${card.name}`}
    id="card-{card.filePath.replace(/[^a-zA-Z0-9]/g, '-')}"
  >
    <!-- Hotkey badge -->
    {#if card.hotkey}
      <div class="card-hotkey">{card.hotkey}</div>
    {/if}

    <!-- Card header -->
    <div class="card-header">
      <h3 class="card-title">{card.name}</h3>
      <span class="card-ext">{card.extension}</span>
    </div>

    <!-- Card content preview -->
    <div class="card-content" class:full={isFull}>
      <pre class="card-text">{card.content}</pre>
      {#if !isFull}
        <div class="card-fade"></div>
      {/if}
    </div>

    <!-- Edit mode icon indicator -->
    {#if isEditMode}
      <div class="edit-indicator">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M8.5 2.5l3 3L4.5 12.5H1.5v-3l7-7z"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linejoin="round"
            fill="none"
          />
        </svg>
      </div>
    {/if}

    <!-- Copy indicator overlay -->
    {#if isFlashing}
      <div class="copy-overlay">
        <span class="copy-icon">✓</span>
      </div>
    {/if}
  </button>
{/if}

<style>
  .snippet-card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: var(--color-card-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
    break-inside: avoid;
    margin-bottom: var(--space-3);
    text-align: left;
    font-family: var(--font-family);
    width: 100%;
    color: var(--color-text-primary);
  }

  .snippet-card:hover {
    border-color: var(--color-accent-cyan);
    transform: translateY(-2px);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(0, 210, 255, 0.1);
  }

  .snippet-card.edit-mode:hover {
    border-color: var(--color-accent-violet);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(123, 97, 255, 0.2);
  }

  .snippet-card:active {
    transform: translateY(0);
  }

  .snippet-card.editing {
    cursor: default;
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
  }

  .snippet-card:hover .card-hotkey {
    opacity: 1;
    background: var(--color-accent-gradient);
    color: var(--color-bg-primary);
  }

  /* Card header */
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 8px;
    padding-right: 48px; /* space for hotkey badge */
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
  }

  .card-content.full {
    max-height: none;
    overflow: visible;
  }

  .card-text {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
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
  }

  /* Edit mode indicator */
  .edit-indicator {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--color-surface-3);
    color: var(--color-accent-violet);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .snippet-card.edit-mode:hover .edit-indicator {
    opacity: 1;
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
