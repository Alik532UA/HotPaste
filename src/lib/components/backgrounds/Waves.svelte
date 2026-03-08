<script lang="ts">
    import { onMount } from "svelte";
    import { WavesEngine } from "./engine/WavesEngine";

    let { theme = "dark" } = $props<{ theme?: string }>();

    let canvas: HTMLCanvasElement;
    let engine: WavesEngine;

    $effect(() => {
        if (engine) {
            engine.setTheme(theme);
        }
    });

    onMount(() => {
        engine = new WavesEngine(theme);
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
