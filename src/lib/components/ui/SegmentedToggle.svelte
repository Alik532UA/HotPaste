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

    let { id, options, value, onSelect, isCompact = false, testId }: { 
        id: string, 
        options: Option[], 
        value: string, 
        onSelect: (id: any) => void,
        isCompact?: boolean,
        testId?: string
    } = $props();

    let isOpen = $state(false);

    // Helper to get active option
    const activeOption = $derived(options.find(opt => opt.id === value) || options[0]);

    // Final test ID: use provided testId or build default one
    const finalTestId = $derived(testId || (id === 'view' ? `segmented-wrapper-${id}` : `segmented-control-desktop-${id}`));
    
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
        console.log(`[SegmentedToggle ${id}] selecting: ${id}`);
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
     class:is-compact={isCompact}
     data-testid={finalTestId}>
    
    <!-- 1. Full View -->
    <div class="view-full segmented-control" class:is-hidden={isCompact} aria-hidden={isCompact}>
        {#each options as opt}
            <button 
                class:active={value === opt.id}
                class:icon-only={opt.icon && !opt.label}
                onclick={() => onSelect(opt.id)}
                title={opt.label}
                type="button"
                data-testid={`segmented-opt-${id}-${opt.id}`}
                tabindex={isCompact ? -1 : 0}
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

    <!-- 2. Compact View -->
    <div class="view-compact" class:is-hidden={!isCompact} aria-hidden={!isCompact} use:handleClickOutside>
        {#if options.length === 2}
            <!-- 2 options -> Single Switch Button -->
            <button 
                class="compact-trigger toggle-mode" 
                class:icon-only={activeOption.icon && !activeOption.label}
                onclick={handleToggle}
                title={activeOption.label}
                type="button"
                data-testid={`segmented-toggle-compact-${id}`}
                tabindex={!isCompact ? -1 : 0}
            >
                {#if activeOption.icon} 
                    <activeOption.icon size={14} class={activeOption.iconClass} /> 
                {/if}
                {#if activeOption.label}
                    <span class="label">{activeOption.label}</span>
                {/if}
            </button>
        {:else}
            <!-- More than 2 options -> Custom Dropdown -->
            <button 
                class="compact-trigger dropdown-mode" 
                class:active={isOpen}
                onclick={handleToggle}
                type="button"
                data-testid={`segmented-dropdown-trigger-${id}`}
                tabindex={!isCompact ? -1 : 0}
            >
                {#if activeOption.icon} 
                    <activeOption.icon size={14} class={activeOption.iconClass} /> 
                {/if}
                {#if activeOption.label}
                    <span class="label">{activeOption.label}</span>
                {/if}
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
                                {#if opt.label}
                                    <span>{opt.label}</span>
                                {/if}
                            </div>
                            <div class="check-placeholder" style="width: 14px; height: 14px; display: flex; flex-shrink: 0; align-items: center; justify-content: center;">
                                {#if value === opt.id}
                                    <Check size={14} class="segmented-check-icon" />
                                {/if}
                            </div>
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

    /* Keep both views for measurements, but hide inactive one */
    .is-hidden {
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        opacity: 0;
        z-index: -1;
    }

    /* Standard Segmented Control */
    .segmented-control {
        display: flex;
        background: var(--color-surface-1);
        padding: 2px;
        border-radius: 10px;
        border: 1px solid var(--color-border);
        gap: 2px;
        height: 36px; /* Fixed height */
        box-sizing: border-box;
    }

    button {
        display: flex;
        align-items: center;
        justify-content: center; /* Center content horizontally */
        gap: 6px;
        padding: 0 12px; /* Removed vertical padding, using height instead */
        height: 100%;    /* Take full container height */
        border: none;
        background: transparent;
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        white-space: nowrap;
        min-width: 32px; /* Ensure small buttons are square-ish */
        box-sizing: border-box;
    }

    .label {
        font-family: inherit;
    }

    /* Remove gap for icon-only buttons to ensure perfect centering */
    button.icon-only {
        gap: 0;
        padding: 0 10px;
    }

    button:hover:not(.active):not(.selected) {
        background: var(--color-surface-2);
        color: var(--color-text-secondary);
    }

    .active {
        background: var(--color-surface-3);
        color: var(--color-accent-cyan);
        box-shadow: var(--shadow-sm);
    }

    /* Compact Trigger Styles */
    .compact-trigger {
        background: var(--color-surface-1);
        border: 1px solid var(--color-border);
        padding: 0 12px;
        border-radius: 10px;
        color: var(--color-accent-cyan);
        min-width: 40px;
        height: 36px; /* Fixed height */
        box-sizing: border-box;
    }

    .compact-trigger:hover {
        border-color: var(--color-accent-cyan);
        background: var(--color-surface-2);
    }

    :global(.chevron) {
        color: var(--color-text-muted);
        transition: transform 0.2s ease;
        margin-left: 4px;
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
        background: var(--glass-bg);
        backdrop-filter: var(--backdrop-filter);
        -webkit-backdrop-filter: var(--backdrop-filter);
        border: 1px solid var(--glass-border);
        border-radius: 12px;
        padding: 6px;
        z-index: 2000;
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .menu-item {
        display: flex;
        align-items: center;
        width: 100%;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 8px;
        color: var(--color-text-secondary);
        gap: 12px;
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

    :global(.segmented-check-icon) {
        color: var(--color-accent-cyan);
    }

    /* Logic: Switch between views */
    .view-full {
        display: flex;
    }
    .view-compact {
        display: flex;
    }

    /* Global animation support */
    :global(.active) .label, :global(.selected) .label {
        color: inherit;
    }
</style>
