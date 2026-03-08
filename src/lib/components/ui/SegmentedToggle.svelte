<script lang="ts">
    import type { ComponentType } from 'svelte';

    interface Option {
        id: string;
        label: string;
        icon?: ComponentType<any>;
        iconClass?: string; // Support for animation classes
    }

    let { options, value, onSelect }: { options: Option[], value: string, onSelect: (id: any) => void } = $props();
</script>

<div class="segmented-control">
    {#each options as opt}
        <button 
            class:active={value === opt.id}
            onclick={() => onSelect(opt.id)}
            title={opt.label}
            type="button"
        >
            {#if opt.icon} 
                <opt.icon size={14} class={opt.iconClass} /> 
            {/if}
            {#if opt.label}
                <span class="label">{opt.label}</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .segmented-control {
        display: flex;
        background: var(--color-surface-1);
        padding: 2px;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        gap: 2px;
    }

    button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
    }

    button:hover:not(.active) {
        background: var(--color-surface-2);
        color: var(--color-text-secondary);
    }

    button.active {
        background: var(--color-surface-3);
        color: var(--color-accent-cyan);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .label {
        line-height: 1;
    }

    /* Support for global animation classes on icons */
    :global(.active) .label {
        color: var(--color-accent-cyan);
    }

    @media (max-width: 800px) {
        .label {
            display: none;
        }
        button {
            padding: 6px;
        }
    }
</style>
