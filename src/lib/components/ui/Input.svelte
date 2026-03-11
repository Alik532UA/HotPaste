<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import type { Component } from "svelte";

  interface Props extends HTMLInputAttributes {
    label?: string;
    icon?: any;
    error?: string;
    hint?: string;
    testId?: string;
  }

  let { 
    label, 
    icon: Icon, 
    error, 
    hint, 
    value = $bindable(""), 
    testId,
    class: className,
    id = Math.random().toString(36).substring(7),
    ...rest 
  }: Props = $props();
</script>

<div class="form-field {className || ''}" data-error={!!error}>
  {#if label}
    <label for={id}>{label}</label>
  {/if}

  <div class="input-wrapper">
    {#if Icon}
      <div class="icon-container">
        <Icon size={18} />
      </div>
    {/if}

    <input
      {id}
      bind:value={value}
      class:has-icon={!!Icon}
      data-testid={testId}
      onkeydown={(e) => e.stopPropagation()}
      {...rest}
    />
  </div>

  {#if error}
    <span class="error-text">{error}</span>
  {:else if hint}
    <span class="hint-text">{hint}</span>
  {/if}
</div>

<style>
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .icon-container {
    position: absolute;
    left: 14px;
    color: var(--color-text-muted);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  input {
    width: 100%;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 16px;
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    transition: all 0.2s;
    outline: none;
  }

  input.has-icon {
    padding-left: 44px;
  }

  input:focus {
    border-color: var(--color-accent-violet);
    background: var(--color-bg-primary);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent-violet) 10%, transparent);
  }

  .error-text {
    font-size: 0.75rem;
    color: var(--color-danger);
  }

  .hint-text {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    opacity: 0.8;
  }

  /* Global integration for search specifically */
  :global(.search-input) input {
    border-radius: 12px;
    background: var(--color-surface-2);
  }
</style>
