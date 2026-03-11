<script lang="ts">
  import { Search, X } from "lucide-svelte";
  import Input from "./Input.svelte";
  import { t } from "../../i18n";

  interface Props {
    value?: string;
    placeholder?: string;
    testId?: string;
    class?: string;
    [key: string]: any;
  }

  let { 
    value = $bindable(""), 
    placeholder = t.common.search,
    testId = "search-input",
    class: className,
    ...rest 
  }: Props = $props();

  function clear() {
    value = "";
  }
</script>

<div class="search-wrapper {className || ''}" class:has-value={!!value}>
  <Input
    icon={Search}
    bind:value={value}
    placeholder={placeholder}
    class="search-field"
    testId={testId}
    autocomplete="off"
    {...rest}
  />
  {#if value}
    <button 
      class="clear-action" 
      onclick={clear} 
      title={t.common.cancel}
      aria-label={t.common.cancel}
      data-testid="{testId}-clear"
    >
      <X size={16} strokeWidth={2.5} />
    </button>
  {/if}
</div>

<style>
  .search-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    min-height: 36px;
  }

  :global(.search-field input) {
    height: 36px !important;
    width: 100% !important;
    padding-right: 44px !important; /* Increased space for the button */
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    border-radius: 12px !important;
    background: var(--color-surface-1) !important;
    border: 1px solid var(--color-border) !important;
    transition: all 0.2s ease-in-out !important;
  }

  :global(.search-field input:focus) {
    border-color: var(--color-accent-violet) !important;
    background: var(--color-surface-2) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-violet) 15%, transparent) !important;
  }

  .clear-action {
    position: absolute;
    right: 7px;
    width: 28px;
    height: 28px;
    background: color-mix(in srgb, var(--color-text-muted) 10%, transparent);
    border: none;
    color: var(--color-text-muted);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 3;
  }

  .clear-action:hover {
    background: var(--color-danger);
    color: white;
    transform: scale(1.05);
  }

  .clear-action:active {
    transform: scale(0.95);
  }
</style>
