<script lang="ts">
    import { background } from '../states/background.svelte';
    import { theme } from '../states/theme.svelte';
    import { uiState } from '../stores/uiState.svelte';
    import Waves from './backgrounds/Waves.svelte';
    import Particles from './backgrounds/Particles.svelte';
    import FloatingShapes from './backgrounds/FloatingShapes.svelte';
    import { fade } from 'svelte/transition';

    const currentTheme = $derived(theme.current);
</script>

<div class="dynamic-bg-container" class:minimal={uiState.isMinimalMode}>
    {#if background.type === 'particles'}
        <div class="bg-layer" transition:fade={{ duration: 1000 }}>
            <Particles theme={currentTheme} />
        </div>
    {:else if background.type === 'waves'}
        <div class="bg-layer" transition:fade={{ duration: 1000 }}>
            <Waves theme={currentTheme} />
        </div>
    {:else if background.type === 'floating_shapes'}
        <div class="bg-layer" transition:fade={{ duration: 1000 }}>
            <FloatingShapes theme={currentTheme} />
        </div>
    {/if}
</div>

<style>
    .dynamic-bg-container {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        overflow: hidden;
        background-color: var(--color-bg-primary);
        transition: background-color 0.3s ease;
    }

    .bg-layer {
        position: absolute;
        inset: 0;
    }
</style>
