<script lang="ts">
	import { Copy, Check, Bug, Trash2, EyeOff } from 'lucide-svelte';
	import { logService } from '../../services/logService.svelte';
	import { debugMode } from '../../services/debugMode.svelte';
	import ErrorLogModal from './ErrorLogModal.svelte';

	let copied = $state(false);
	let fallbackReport = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	let menuOpen = $state(false);
	let modalOpen = $state(false);
	let userDismissed = $state(false);

	const errorCount = $derived(logService.errorCount);
	const appVersion = $derived(logService.appVersion);

	const urlDebug = $derived(
		typeof window !== 'undefined' &&
			new URLSearchParams(window.location.search).get('debug') === '1'
	);
	const isVisible = $derived(!userDismissed && (urlDebug || debugMode.enabled));

	async function copyReport() {
		const report = logService.getReport();
		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(report);
			} else {
				throw new Error('Clipboard API unavailable in this context');
			}
			fallbackReport = null;
			copied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1500);
		} catch (err) {
			logService.warn('LogCopyButton', 'Failed to copy logs to clipboard', err);
			fallbackReport = report;
		}
	}

	async function handleAction(action: 'copy' | 'modal' | 'clear' | 'hide') {
		menuOpen = false;
		if (action === 'copy') await copyReport();
		else if (action === 'modal') modalOpen = true;
		else if (action === 'clear') logService.clear();
		else if (action === 'hide') {
			userDismissed = true;
			if (debugMode.enabled) debugMode.set(false);
		}
	}

	function handleWindowClick(e: MouseEvent) {
		if (!menuOpen) return;
		const target = e.target as HTMLElement | null;
		if (!target?.closest('.service-badge-wrapper')) {
			menuOpen = false;
		}
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && menuOpen) {
			menuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

{#if fallbackReport}
	<textarea
		class="log-fallback"
		readonly
		value={fallbackReport}
		aria-label="Debug report fallback"
		data-testid="debug-log-fallback-input"
	></textarea>
{/if}

{#if isVisible}
	<div class="service-badge-wrapper">
		{#if menuOpen}
			<div class="service-menu" role="menu" data-testid="service-badge-context-menu">
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => handleAction('copy')}
					data-testid="service-badge-copy-report-btn"
				>
					<Copy size={13} />
					<span>Скопіювати повний звіт</span>
				</button>
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => handleAction('modal')}
					data-testid="service-badge-view-errors-btn"
				>
					<Bug size={13} />
					<span>Переглянути помилки ({errorCount})</span>
				</button>
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => handleAction('clear')}
					data-testid="service-badge-clear-btn"
				>
					<Trash2 size={13} />
					<span>Скинути лічильник</span>
				</button>
				<button
					type="button"
					class="menu-item"
					role="menuitem"
					onclick={() => handleAction('hide')}
					data-testid="service-badge-hide-btn"
				>
					<EyeOff size={13} />
					<span>Приховати табло</span>
				</button>
			</div>
		{/if}

		<button
			type="button"
			class="log-copy-fab"
			class:has-error={errorCount > 0}
			class:is-copied={copied}
			onclick={() => (menuOpen = !menuOpen)}
			oncontextmenu={(e) => {
				e.preventDefault();
				menuOpen = true;
			}}
			aria-label="Меню діагностики — {appVersion}"
			aria-haspopup="menu"
			aria-expanded={menuOpen}
			data-testid="log-copy-fab"
		>
			{#if copied}
				<Check class="fab-icon" size={14} />
			{:else if errorCount > 0}
				<span class="error-count">{errorCount > 99 ? '99+' : errorCount}</span>
			{:else}
				<Copy class="fab-icon" size={12} />
			{/if}
			<span class="version">{appVersion}</span>
		</button>
	</div>
{/if}

<ErrorLogModal isOpen={modalOpen} onclose={() => (modalOpen = false)} />

<style>
	.service-badge-wrapper {
		position: fixed;
		bottom: 24px;
		left: 24px;
		z-index: 9999;
	}

	.service-menu {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		min-width: 220px;
		background: #1e1e1e;
		backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 12px;
		padding: 6px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
		display: flex;
		flex-direction: column;
		gap: 2px;
		z-index: 10000;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.log-copy-fab {
		min-height: 32px;
		padding: 0 10px;
		border-radius: 16px;
		background: var(--color-surface-2, #242424);
		color: var(--color-text-secondary, #cccccc);
		border: 1.5px solid var(--color-border, #444444);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		font-family: inherit;
		outline: none;
	}

	.log-copy-fab:hover {
		transform: scale(1.05);
		background: var(--color-surface-3, #333333);
		color: var(--color-text-primary, #ffffff);
	}

	.log-copy-fab.has-error {
		background: #c92a2a;
		border-color: #7f1d1d;
		color: #ffffff;
	}

	.log-copy-fab.is-copied {
		background: #237a35;
		border-color: #1b5e20;
		color: #ffffff;
	}

	.error-count {
		font-family: monospace;
		font-weight: 800;
		font-size: 10px;
		padding: 2px 5px;
		border-radius: 8px;
		background: #7f1d1d;
		color: white;
	}

	.version {
		font-family: monospace;
		font-size: 11px;
		line-height: 1;
		white-space: nowrap;
	}

	.log-fallback {
		position: fixed;
		bottom: 76px;
		left: 24px;
		width: min(38rem, calc(100vw - 48px));
		height: min(40dvh, 20rem);
		z-index: 9999;
		padding: 8px;
		font-family: monospace;
		font-size: 0.75rem;
		background: #1e1e1e;
		color: #ffffff;
		border: 2px solid #ef4444;
		border-radius: 8px;
		resize: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.menu-item,
		.log-copy-fab {
			transition: none;
		}
	}

	@media (hover: none) {
		.service-badge-wrapper {
			bottom: 12px;
			left: 12px;
		}

		.log-copy-fab {
			min-height: 44px;
			padding: 0 14px;
			border-radius: 22px;
		}

		.version {
			font-size: 12px;
		}
	}
</style>
