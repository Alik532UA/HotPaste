<script lang="ts">
  /**
   * TextHighlight — highlights matches of a query within a string.
   */
  interface Props {
    text: string;
    query: string;
  }

  let { text, query }: Props = $props();

  const parts = $derived(() => {
    if (!query.trim()) return [text];
    
    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.split(regex);
  });
</script>

{#each parts() as part}
  {#if part.toLowerCase() === query.toLowerCase()}
    <mark class="highlight">{part}</mark>
  {:else}
    {part}
  {/if}
{/each}

<style>
  .highlight {
    background: var(--color-accent-cyan);
    color: #000;
    padding: 0 2px;
    border-radius: 2px;
    font-weight: inherit;
  }
</style>
