<script lang="ts">
    import { background } from '../states/background.svelte';
    import Waves from './backgrounds/Waves.svelte';
    import Particles from './backgrounds/Particles.svelte';
    import Mesh from './backgrounds/Mesh.svelte';

    const backgrounds = {
        waves: Waves,
        particles: Particles,
        mesh: Mesh,
        none: null
    };

    let ActiveBg = $derived(backgrounds[background.type]);
</script>

<div class="dynamic-bg-container">
    {#if ActiveBg}
        <ActiveBg />
    {/if}
</div>

<style>
    .dynamic-bg-container {
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        overflow: hidden;
    }
</style>
