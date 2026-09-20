<script lang="ts">
    import { onDestroy } from 'svelte';
    import { useRegisterSW } from 'virtual:pwa-register/svelte';
    import { isTauri } from '../../utils/runtime';
    import { logService } from '../../services/logService.svelte';
    import { RefreshCw, X } from 'lucide-svelte';

    /**
     * ПРОПОЗИЦІЯ ОНОВИТИСЯ — саме пропозиція, а не оновлення.
     *
     * Воркер зареєстрований із `registerType: 'prompt'`: новий стоїть у
     * `waiting` і не чіпає відкриту вкладку, доки людина не погодиться. Для
     * цього застосунку це важить більше, ніж деінде — у роботі відкрита тека з
     * файлами, і перезавантаження посеред редагування сніпета це втрачений
     * текст.
     *
     * Якщо ця панель колись перестане з'являтися — дивитися треба не сюди, а в
     * `vite.config.ts`: при `skipWaiting` воркер не чекає ніколи, тож
     * `needRefresh` не стає `true` жодного разу, і готовий UI стає мертвим
     * кодом. Саме в такому стані тут і був `UpdateModal`: він живився окремим
     * опитуванням `app-version.json` і про воркер не знав нічого.
     *
     * ## Чому не у вікні застосунку
     *
     * У Tauri service worker шкідливий: він закешує вшиту в exe оболонку й
     * віддаватиме її після того, як оновлювач поставить нову версію. Тобто
     * застосунок оновився б, а показував би стару збірку — і полагодити це
     * можна було б лише через DevTools, яких у людини немає.
     *
     * Тому реєстрація умовна, і саме тому `injectRegister` у конфігу
     * вимкнений: вбудована реєстрація вмикається безумовно й місця для умови
     * не лишає.
     *
     * ## Чому питаємо самі
     *
     * Браузер перевіряє воркер лише на НАВІГАЦІЇ, а цей застосунок тримають
     * відкритим годинами й не перезавантажують. Без цих трьох підписок
     * пропозиція не з'явилася б до наступного відкриття вкладки.
     *
     * Повернення до вкладки піднімає І `visibilitychange`, І `focus`, тож без
     * спільного проміжку одне переключення вікна дає два запити поспіль.
     */

    const CHECK_EVERY_MS = 30 * 60 * 1000;
    const MIN_GAP_MS = 60 * 1000;

    let timer: ReturnType<typeof setInterval> | null = null;
    let unwatch: (() => void) | null = null;
    let lastCheckAt = 0;

    const { needRefresh, updateServiceWorker } = useRegisterSW({
        // Єдина умова: у вікні застосунку воркера не реєструємо взагалі.
        immediate: !isTauri(),
        onRegisteredSW(_url, registration) {
            if (!registration) return;

            const tick = () => {
                if (navigator.onLine === false) return;
                const now = Date.now();
                if (lastCheckAt !== 0 && now - lastCheckAt < MIN_GAP_MS) return;
                lastCheckAt = now;
                // Мережа впала — це не подія для людини: пропозиція просто не
                // з'явиться, а наступний тік спробує знову.
                void registration.update().catch(() => {});
            };

            timer = setInterval(tick, CHECK_EVERY_MS);

            const onReturn = () => {
                if (document.visibilityState === 'visible') tick();
            };
            document.addEventListener('visibilitychange', onReturn);
            window.addEventListener('focus', onReturn);
            unwatch = () => {
                document.removeEventListener('visibilitychange', onReturn);
                window.removeEventListener('focus', onReturn);
            };
        },
        onRegisterError(error) {
            logService.error('PWA', `Service worker registration failed: ${error}`);
        }
    });

    onDestroy(() => {
        if (timer !== null) clearInterval(timer);
        timer = null;
        unwatch?.();
        unwatch = null;
    });
</script>

{#if $needRefresh}
    <div class="reload" role="status" data-testid="reload-prompt">
        <span class="text">Готова нова версія інтерфейсу.</span>
        <div class="buttons">
            <button
                class="apply"
                onclick={() => updateServiceWorker(true)}
                data-testid="btn-reload-apply"
            >
                <RefreshCw size={16} />
                Оновити
            </button>
            <button
                class="later"
                onclick={() => needRefresh.set(false)}
                data-testid="btn-reload-later"
            >
                <X size={16} />
                Пізніше
            </button>
        </div>
    </div>
{/if}

<style>
    .reload {
        position: fixed;
        inset-inline: 16px;
        bottom: calc(16px + env(safe-area-inset-bottom));
        z-index: 9999;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
        max-width: 480px;
        margin-inline: auto;
        padding: 14px 18px;
        border: 1px solid var(--border-color, #333);
        border-radius: 14px;
        background: var(--bg-elevated, #1a1a1a);
        color: var(--text-primary, #eee);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }

    .text {
        font-size: 0.9rem;
    }

    .buttons {
        display: flex;
        gap: 8px;
    }

    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: none;
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
    }

    .apply {
        background: #3a8fd6;
        color: #fff;
    }

    .apply:hover {
        background: #4da3ea;
    }

    .later {
        background: transparent;
        color: var(--text-secondary, #888);
    }

    .later:hover {
        color: var(--text-primary, #ccc);
    }
</style>
