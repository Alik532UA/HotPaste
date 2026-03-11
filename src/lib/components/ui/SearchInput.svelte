<script lang="ts">
  import { Search, X } from "lucide-svelte";
  import Input from "./Input.svelte";
  import { t } from "../../i18n";
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props {
    value?: string;
    placeholder?: string;
    testId?: string;
    class?: string;
  }

  let { 
    value = $bindable(""), 
    placeholder = t.common.search,
    testId,
    class: className,
    ...rest 
  }: Props = $props();

  function clear() {
    value = "";
  }
</script>

<div class="search-container">
  <Input
    icon={Search}
    bind:value={value}
    placeholder={t.common.search}
    class="search-input"
    testId={testId}
    autocomplete="off"
    {...rest}
  />
  {#if value}
    <button 
      class="clear-btn" 
      onclick={clear} 
      aria-label={t.common.cancel}
      data-testid="{testId}-clear"
    >
      <X size={14} />
    </button>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
  }

  .clear-btn {
    position: absolute;
    right: 12px;
    background: var(--color-surface-3);
    border: none;
    color: var(--color-text-muted);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 2;
  }

  .clear-btn:hover {
    background: var(--color-accent-violet);
    color: white;
    transform: scale(1.1);
  }

  :global(.search-input) {
    width: 100%;
  }
</style>
