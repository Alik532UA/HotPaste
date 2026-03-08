<script lang="ts">
  import type { Card } from '../types';
  import { getState, copyCard } from '../stores/appState.svelte';

  interface Props {
    card: Card;
  }

  let { card }: Props = $props();

  const state = getState();

  const isFlashing = $derived(state.flashingCardPath === card.filePath);

  function handleClick() {
    copyCard(card);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyCard(card);
    }
  }
</script>

<button
  class="snippet-card"
  class:flashing={isFlashing}
  onclick={handleClick}
  onkeydown={handleKeydown}
  title="Натисніть '{card.hotkey}' або клікніть, щоб скопіювати"
  aria-label="Скопіювати сніпет: {card.name}"
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
  <div class="card-content">
    <pre class="card-text">{card.content}</pre>
    <div class="card-fade"></div>
  </div>

  <!-- Copy indicator overlay -->
  {#if isFlashing}
    <div class="copy-overlay">
      <span class="copy-icon">✓</span>
    </div>
  {/if}
</button>

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

  .snippet-card:active {
    transform: translateY(0);
  }

  .snippet-card.flashing {
    border-color: var(--color-accent-green);
    box-shadow:
      0 0 20px rgba(0, 255, 136, 0.2),
      0 0 0 2px rgba(0, 255, 136, 0.3);
    animation: flashPulse 0.4s ease;
  }

  @keyframes flashPulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 255, 136, 0.4); }
    50% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.3), 0 0 0 3px rgba(0, 255, 136, 0.4); }
    100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.2), 0 0 0 2px rgba(0, 255, 136, 0.3); }
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
    transition: opacity 0.2s ease, background 0.2s ease;
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
    background: linear-gradient(
      to bottom,
      transparent,
      var(--color-card-bg)
    );
    pointer-events: none;
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
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
