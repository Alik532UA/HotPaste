<script lang="ts">
    import { dataService } from "../services/dataService";
    import { onMount } from "svelte";

    let pauseClickCount = $state(0);
    let lastPauseClick = $state(0);

    const CLEAR_THRESHOLD = import.meta.env.DEV ? 5 : 55;
    const CLICK_TIMEOUT = 1000; // Reset counter after 1s of inactivity

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Pause" || e.key === "Break") {
            const now = Date.now();
            if (now - lastPauseClick > CLICK_TIMEOUT) {
                pauseClickCount = 1;
            } else {
                pauseClickCount++;
            }
            lastPauseClick = now;

            if (pauseClickCount >= CLEAR_THRESHOLD) {
                pauseClickCount = 0;
                dataService.clearAllData().then(() => {
                    window.location.reload();
                });
            }
        }
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    });
</script>

<!-- This component is now invisible and only handles the emergency data clear (Pause/Break key) -->
{#if pauseClickCount > 0}
    <div class="pause-indicator">
        {pauseClickCount} / {CLEAR_THRESHOLD}
    </div>
{/if}

<style>
    .pause-indicator {
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        z-index: 10000;
        pointer-events: none;
        font-family: monospace;
    }
</style>
