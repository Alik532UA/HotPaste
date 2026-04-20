<script lang="ts">
    import { versionStore } from "../../stores/versionStore.svelte";
    import { applyUpdateAndDeepClean, skipUpdate } from "../../services/versionService";
    import { RefreshCw, X, AlertOctagon, Power } from "lucide-svelte";
</script>

{#if versionStore.isUpdateAvailable}
    <div class="modal-overlay" data-testid="update-modal-overlay">
        <div class="update-card shadow-xl" data-testid="update-modal-content">
            {#if versionStore.needsManualRestart}
                <!-- FALLBACK: Повідомлення про ручний перезапуск -->
                <div class="icon-container error" data-testid="update-icon-error">
                    <AlertOctagon size={48} />
                </div>
                <h2 data-testid="update-title">Потрібна дія</h2>
                <p data-testid="update-desc">Кеш очищено, але автоматичний перезапуск не вдався.</p>
                <div class="warning-box" data-testid="update-warning-box">
                    Будь ласка, <b>закрийте та запустіть програму вручну</b> для завершення оновлення.
                </div>
                <button class="btn-primary" onclick={() => window.close()} data-testid="btn-update-close-app">
                    <Power size={18} /> Закрити програму
                </button>
            {:else}
                <!-- СТАНДАРТНЕ ВІКНО -->
                <div class="icon-container accent" data-testid="update-icon-accent">
                    <RefreshCw size={48} class="spin-once" />
                </div>
                <h2 data-testid="update-title">Доступна нова версія!</h2>
                <p data-testid="update-version-info">Версія <b data-testid="update-server-version">{versionStore.serverVersion}</b> готова до встановлення.</p>
                
                <div class="warning-box" data-testid="update-warning-box">
                    Це оновлення повністю очистить веб-кеш інтерфейсу для стабільної роботи. 
                    Ваші підключені папки та файли <b>не постраждають</b>.
                </div>

                <div class="actions" data-testid="update-actions">
                    <button class="btn-primary" onclick={applyUpdateAndDeepClean} data-testid="btn-update-apply">
                        <RefreshCw size={18} />
                        Оновити та очистити кеш
                    </button>
                    
                    <button class="btn-ghost" onclick={skipUpdate} data-testid="btn-update-skip">
                        <X size={18} />
                        Скасувати (на 5 днів)
                    </button>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    }

    .update-card {
        background: #1a1a1a;
        border: 1px solid #333;
        padding: 2.5rem;
        border-radius: 24px;
        max-width: 420px;
        width: 100%;
        text-align: center;
        color: #eee;
    }

    .icon-container {
        display: flex;
        justify-content: center;
        margin-bottom: 1.5rem;
    }

    .icon-container.accent { color: #3a8fd6; }
    .icon-container.error { color: #ff4444; }

    h2 {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    p {
        color: #aaa;
        margin-bottom: 1rem;
    }

    .warning-box {
        background: rgba(255, 255, 255, 0.05);
        padding: 1rem;
        border-radius: 12px;
        font-size: 0.85rem;
        color: #888;
        margin: 1.5rem 0;
        line-height: 1.4;
        text-align: left;
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .btn-primary {
        background: #3a8fd6;
        color: white;
        border: none;
        padding: 14px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: background 0.2s;
    }

    .btn-primary:hover {
        background: #4da3ea;
    }

    .btn-ghost {
        background: transparent;
        color: #666;
        border: none;
        padding: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 0.9rem;
        transition: color 0.2s;
    }

    .btn-ghost:hover {
        color: #999;
    }

    :global(.spin-once) {
        animation: spin 1s ease-in-out;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
