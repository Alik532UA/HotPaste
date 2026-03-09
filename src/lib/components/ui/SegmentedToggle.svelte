<script lang="ts">
    import type { ComponentType } from 'svelte';
    import { ChevronDown, Check } from 'lucide-svelte';
    import { fade, fly } from 'svelte/transition';

    interface Option {
        id: string;
        label: string;
        icon?: ComponentType<any>;
        iconClass?: string; 
    }

    let { id, options, value, onSelect }: { 
        id: string, 
        options: Option[], 
        value: string, 
        onSelect: (id: any) => void 
    } = $props();

    let isOpen = $state(false);

    // Helper to get active option
    const activeOption = $derived(options.find(opt => opt.id === value) || options[0]);
    
    // Toggle for 2-option case
    function handleToggle() {
        if (options.length === 2) {
            const nextIdx = options[0].id === value ? 1 : 0;
            onSelect(options[nextIdx].id);
        } else {
            isOpen = !isOpen;
        }
    }

    function selectOption(id: string) {
        onSelect(id);
        isOpen = false;
    }

    // Close on click outside
    function handleClickOutside(node: HTMLElement) {
        const handleClick = (event: MouseEvent) => {
            if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
                isOpen = false;
            }
        };
        document.addEventListener('click', handleClick, true);
        return {
            destroy() {
                document.removeEventListener('click', handleClick, true);
            }
        };
    }
</script>

<div class="segmented-wrapper" 
     class:has-two={options.length === 2} 
     class:has-many={options.length > 2} 
     data-testid={`segmented-wrapper-${id}`}>
    
    <!-- 1. Full View -->
    <div class="view-full segmented-control" data-testid={`segmented-control-desktop-${id}`}>
        {#each options as opt}
            <button 
                class:active={value === opt.id}
                onclick={() => onSelect(opt.id)}
                title={opt.label}
                type="button"
                data-testid={`segmented-opt-${id}-${opt.id}`}
            >
                {#if opt.icon} 
                    <opt.icon size={14} class={opt.iconClass} /> 
                {/if}
                <span class="label">{opt.label}</span>
            </button>
        {/each}
    </div>

    <!-- 2. Compact View -->
    <div class="view-compact" use:handleClickOutside data-testid={`segmented-control-compact-${id}`}>
        {#if options.length === 2}
            <!-- 2 options -> Single Switch Button -->
            <button 
                class="compact-trigger toggle-mode" 
                onclick={handleToggle}
                title={activeOption.label}
                type="button"
                data-testid={`segmented-toggle-compact-${id}`}
            >
                {#if activeOption.icon} 
                    <activeOption.icon size={14} class={activeOption.iconClass} /> 
                {/if}
                <span class="label">{activeOption.label}</span>
            </button>
        {:else}
            <!-- More than 2 options -> Custom Dropdown -->
            <button 
                class="compact-trigger dropdown-mode" 
                class:active={isOpen}
                onclick={handleToggle}
                type="button"
                data-testid={`segmented-dropdown-trigger-${id}`}
            >
                {#if activeOption.icon} 
                    <activeOption.icon size={14} class={activeOption.iconClass} /> 
                {/if}
                <span class="label">{activeOption.label}</span>
                <ChevronDown size={14} class={"chevron " + (isOpen ? "rotated" : "")} />
            </button>

            {#if isOpen}
                <div class="dropdown-menu" 
                     in:fly={{ y: 5, duration: 150 }} 
                     out:fade={{ duration: 100 }} 
                     data-testid={`segmented-dropdown-menu-${id}`}>
                    {#each options as opt}
                        <button 
                            class="menu-item" 
                            class:selected={value === opt.id}
                            onclick={() => selectOption(opt.id)}
                            data-testid={`segmented-menu-opt-${id}-${opt.id}`}
                        >
                            <div class="item-content">
                                {#if opt.icon} 
                                    <opt.icon size={14} class={opt.iconClass} /> 
                                {/if}
                                <span>{opt.label}</span>
                            </div>
                            {#if value === opt.id}
                                <Check size={14} class="check-icon" />
                            {/if}
                        </button>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .segmented-wrapper {
        display: inline-flex;
        position: relative;
    }

    /* Standard Segmented Control */
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
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    button:hover:not(.active):not(.selected) {
        background: var(--color-surface-2);
        color: var(--color-text-secondary);
    }

    .active {
        background: var(--color-surface-3);
        color: var(--color-accent-cyan);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Compact Trigger Styles */
    .compact-trigger {
        background: var(--color-surface-1);
        border: 1px solid var(--color-border);
        padding: 6px 12px;
        border-radius: 10px;
        color: var(--color-accent-cyan);
        min-width: 40px;
        justify-content: center;
    }

    .compact-trigger:hover {
        border-color: var(--color-accent-cyan);
        background: var(--color-surface-2);
    }

    :global(.chevron) {
        color: var(--color-text-muted);
        transition: transform 0.2s ease;
    }

    :global(.chevron.rotated) {
        transform: rotate(180deg);
    }

    /* Dropdown Menu Styles */
    .dropdown-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0; 
        min-width: 160px;
        background: rgba(30, 30, 40, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 6px;
        z-index: 2000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .menu-item {
        width: 100%;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 8px;
        color: var(--color-text-secondary);
    }

    .item-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .menu-item.selected {
        background: var(--color-surface-3);
        color: var(--color-accent-cyan);
    }

    :global(.check-icon) {
        color: var(--color-accent-cyan);
    }

    /* Logic: Switch between views is handled by parent or by global styles
       By default, show desktop and hide compact */
    .view-full {
        display: flex;
    }
    .view-compact {
        display: none;
    }

    /* Global animation support */
    :global(.active) .label, :global(.selected) .label {
        color: inherit;
    }
</style>
