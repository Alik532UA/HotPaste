<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { ParticlesEngine } from "./engine/ParticlesEngine";

    let { theme = "dark" } = $props<{ theme?: string }>();

    let canvas: HTMLCanvasElement;
    let engine: ParticlesEngine;

    // Reactive theme update
    $effect(() => {
        if (engine) {
            engine.setTheme(theme);
        }
    });

    onMount(() => {
        engine = new ParticlesEngine(theme);
        if (canvas) {
            engine.mount(canvas);
        }
        
        return () => {
            engine?.unmount();
        };
    });
</script>

<canvas bind:this={canvas} class="bg-canvas"></canvas>

<style>
    .bg-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        pointer-events: none;
    }
</style>
