<script lang="ts">
    import { ClipboardCheck, Play, FolderOpen } from "lucide-svelte";
    import { connectDirectory, connectDefaultProject } from "../stores/appState.svelte";
    import { t } from "../i18n";

    let isHoveringStart = $state(false);
    let isHoveringConnect = $state(false);

    const isTauri = typeof window !== 'undefined' && (!!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__);

    async function handleConnect() {
        await connectDirectory();
    }

    async function handleStart() {
        await connectDefaultProject();
    }
</script>

<div class="empty-state" data-testid="empty-state">
    <div class="empty-content" data-testid="empty-state-content">
        <!-- Logo / Hero -->
        <div class="hero-icon">
            <span class="icon-glow"></span>
            <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect
                    x="8"
                    y="8"
                    width="48"
                    height="48"
                    rx="12"
                    stroke="url(#grad1)"
                    stroke-width="2.5"
                    fill="none"
                />
                <path
                    d="M24 28h16M24 36h10"
                    stroke="url(#grad1)"
                    stroke-width="2.5"
                    stroke-linecap="round"
                />
                <rect
                    x="20"
                    y="20"
                    width="8"
                    height="8"
                    rx="2"
                    fill="url(#grad1)"
                    opacity="0.3"
                />
                <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="64" y2="64">
                        <stop offset="0%" stop-color="#00d2ff" />
                        <stop offset="100%" stop-color="#7b61ff" />
                    </linearGradient>
                </defs>
            </svg>
        </div>

        <h1 class="hero-title">{t.app.title}</h1>
        <p class="hero-subtitle">
            {t.app.subtitle}
        </p>

        <!-- How it works -->
        <div class="flow-demo">
            <div class="flow-step">
                <span class="flow-key">5</span>
                <span class="flow-arrow">→</span>
                <span class="flow-label">{t.app.stepTab}</span>
            </div>
            <div class="flow-step">
                <span class="flow-key">j</span>
                <span class="flow-arrow">→</span>
                <span class="flow-label">{t.app.stepCard}</span>
            </div>
            <div class="flow-step">
                <span class="flow-result"><ClipboardCheck size={24} /></span>
                <span class="flow-label">{t.app.stepCopied}</span>
            </div>
        </div>

        <!-- Action buttons -->
        <div class="actions-container">
            {#if isTauri}
                <button
                    class="start-btn"
                    class:hovering={isHoveringStart}
                    onclick={handleStart}
                    onmouseenter={() => (isHoveringStart = true)}
                    onmouseleave={() => (isHoveringStart = false)}
                    data-testid="btn-start-default"
                >
                    <Play size={20} fill="currentColor" />
                    {t.app.startBtn}
                </button>

                <button
                    class="connect-btn secondary"
                    class:hovering={isHoveringConnect}
                    onclick={handleConnect}
                    onmouseenter={() => (isHoveringConnect = true)}
                    onmouseleave={() => (isHoveringConnect = false)}
                    id="connect-directory-btn"
                    data-testid="btn-connect-directory"
                >
                    <FolderOpen size={20} />
                    {t.app.changeDir}
                </button>
            {:else}
                <button
                    class="connect-btn primary"
                    class:hovering={isHoveringConnect}
                    onclick={handleConnect}
                    onmouseenter={() => (isHoveringConnect = true)}
                    onmouseleave={() => (isHoveringConnect = false)}
                    id="connect-directory-btn"
                    data-testid="btn-connect-directory"
                >
                    <FolderOpen size={20} />
                    {t.app.connectBtn}
                </button>
            {/if}
        </div>

        <p class="hint">
            {@html t.app.connectHint}
        </p>

        <!-- Keyboard hints -->
        <div class="keyboard-hints">
            <div class="hint-row">
                <span class="hint-keys">
                    <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>...<kbd>9</kbd><kbd
                        >0</kbd
                    >
                </span>
                <span class="hint-desc">{t.app.kbSwitchTab}</span>
            </div>
            <div class="hint-row">
                <span class="hint-keys">
                    <kbd>q</kbd><kbd>w</kbd><kbd>e</kbd><kbd>r</kbd>...<kbd
                        >m</kbd
                    >
                </span>
                <span class="hint-desc">{t.app.kbCopyCard}</span>
            </div>
            <div class="hint-row">
                <span class="hint-keys">
                    <kbd>Ctrl</kbd>+<kbd>scroll</kbd>
                </span>
                <span class="hint-desc">{t.app.kbScale}</span>
            </div>
        </div>
    </div>
</div>

<style>
    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: var(--space-6);
    }

    .empty-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        max-width: 500px;
        gap: var(--space-4);
    }

    /* Hero icon */
    .hero-icon {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-2);
    }

    .icon-glow {
        position: absolute;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: radial-gradient(
            circle,
            rgba(0, 210, 255, 0.15),
            transparent 70%
        );
        animation: pulse 3s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            transform: scale(1);
            opacity: 0.5;
        }
        50% {
            transform: scale(1.1);
            opacity: 0.8;
        }
    }

    .hero-title {
        margin: 0;
        font-size: 2.5rem;
        font-weight: 700;
        background: var(--color-accent-gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
    }

    .hero-subtitle {
        margin: 0;
        font-size: 1.05rem;
        color: var(--color-text-muted);
        line-height: 1.6;
        max-width: 360px;
    }

    /* Flow demo */
    .flow-demo {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4);
        border-radius: 16px;
        background: var(--color-surface-1);
        border: 1px solid var(--color-border);
    }

    .flow-step {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .flow-key {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: var(--color-surface-3);
        color: var(--color-accent-cyan);
        font-family: var(--font-mono);
        font-size: 1rem;
        font-weight: 700;
        border: 1px solid var(--color-border);
    }

    .flow-arrow {
        color: var(--color-text-muted);
        font-size: 0.9rem;
        opacity: 0.5;
    }

    .flow-label {
        font-size: 0.8rem;
        color: var(--color-text-muted);
    }

    .flow-result {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-accent-cyan);
    }

    /* Actions container */
    .actions-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        width: 100%;
        max-width: 300px;
        margin: var(--space-2) 0;
    }

    /* Buttons */
    .start-btn, .connect-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px 32px;
        border: none;
        border-radius: 16px;
        font-family: var(--font-family);
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.23, 1, 0.32, 1);
        width: 100%;
    }

    .start-btn {
        background: var(--color-accent-gradient);
        color: #fff;
        box-shadow: 0 4px 20px rgba(0, 210, 255, 0.25);
    }

    .start-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 24px rgba(0, 210, 255, 0.4);
    }

    .connect-btn {
        background: var(--color-surface-2);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
    }

    .connect-btn.secondary {
        font-size: 0.95rem;
        padding: 12px 24px;
        background: transparent;
        color: var(--color-text-muted);
    }

    .connect-btn.primary {
        background: var(--color-accent-gradient);
        color: #fff;
        box-shadow: 0 4px 20px rgba(0, 210, 255, 0.2);
    }

    .connect-btn:hover {
        transform: translateY(-2px);
        background: var(--color-surface-3);
        border-color: var(--color-accent-violet);
    }

    .connect-btn.primary:hover {
        background: var(--color-accent-gradient);
        filter: brightness(1.1);
        box-shadow: 0 8px 32px rgba(0, 210, 255, 0.3);
    }

    .start-btn:active, .connect-btn:active {
        transform: translateY(0);
    }

    /* Hint */
    .hint {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        line-height: 1.6;
        opacity: 0.7;
        margin: 0;
    }

    .hint :global(code) {
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--color-surface-2);
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--color-accent-cyan);
    }

    /* Keyboard hints */
    .keyboard-hints {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: 12px;
        background: var(--color-surface-1);
        border: 1px solid var(--color-border);
        width: 100%;
        max-width: 380px;
    }

    .hint-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
    }

    .hint-keys {
        display: flex;
        align-items: center;
        gap: 3px;
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: var(--color-text-muted);
    }

    .hint-keys kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 22px;
        padding: 0 5px;
        border-radius: 5px;
        background: var(--color-surface-3);
        color: var(--color-text-secondary);
        font-family: var(--font-mono);
        font-size: 0.65rem;
        border: 1px solid var(--color-border);
    }

    .hint-desc {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        opacity: 0.7;
    }
</style>
