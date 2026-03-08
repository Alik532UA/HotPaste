<script lang="ts">
    import { connectDirectory } from "../stores/appState.svelte";

    let isHovering = $state(false);

    async function handleConnect() {
        await connectDirectory();
    }
</script>

<div class="empty-state">
    <div class="empty-content">
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

        <h1 class="hero-title">HotPaste</h1>
        <p class="hero-subtitle">
            Блискавичний менеджер сніпетів з клавіатурною навігацією
        </p>

        <!-- How it works -->
        <div class="flow-demo">
            <div class="flow-step">
                <span class="flow-key">5</span>
                <span class="flow-arrow">→</span>
                <span class="flow-label">Вкладка</span>
            </div>
            <div class="flow-step">
                <span class="flow-key">j</span>
                <span class="flow-arrow">→</span>
                <span class="flow-label">Картка</span>
            </div>
            <div class="flow-step">
                <span class="flow-result">📋</span>
                <span class="flow-label">Скопійовано!</span>
            </div>
        </div>

        <!-- Connect button -->
        <button
            class="connect-btn"
            class:hovering={isHovering}
            onclick={handleConnect}
            onmouseenter={() => (isHovering = true)}
            onmouseleave={() => (isHovering = false)}
            id="connect-directory-btn"
            data-testid="btn-connect-directory"
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M3 5c0-1.1.9-2 2-2h3.17a2 2 0 0 1 1.42.59l.82.82a2 2 0 0 0 1.42.59H15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    fill="none"
                />
            </svg>
            Обрати папку зі сніпетами
        </button>

        <p class="hint">
            Оберіть локальну папку з <code>.txt</code> або <code>.md</code>
            файлами.<br />
            Підпапки стануть вкладками, файли — картками.
        </p>

        <!-- Keyboard hints -->
        <div class="keyboard-hints">
            <div class="hint-row">
                <span class="hint-keys">
                    <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>...<kbd>9</kbd><kbd
                        >0</kbd
                    >
                </span>
                <span class="hint-desc">переключити вкладку</span>
            </div>
            <div class="hint-row">
                <span class="hint-keys">
                    <kbd>q</kbd><kbd>w</kbd><kbd>e</kbd><kbd>r</kbd>...<kbd
                        >m</kbd
                    >
                </span>
                <span class="hint-desc">скопіювати картку</span>
            </div>
            <div class="hint-row">
                <span class="hint-keys">
                    <kbd>Ctrl</kbd>+<kbd>scroll</kbd>
                </span>
                <span class="hint-desc">масштаб</span>
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
        font-size: 1.5rem;
    }

    /* Connect button */
    .connect-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 28px;
        border: none;
        border-radius: 14px;
        background: var(--color-accent-gradient);
        color: #fff;
        font-family: var(--font-family);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;
        box-shadow: 0 4px 20px rgba(0, 210, 255, 0.2);
    }

    .connect-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0, 210, 255, 0.3);
    }

    .connect-btn:active {
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

    .hint code {
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
