import { getState, selectTab, setSearchQuery } from '../stores/appState.svelte';

/**
 * URL Sync Service — Syncs active tab and search query with URL search params.
 * Implements "URL as State" principle.
 */
export function initUrlSync() {
    const appState = getState();

    // 1. Initial read from URL
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
        setSearchQuery(query);
    }

    // 2. Reactive write to URL
    // We use $derived internally via $effect to track state changes
    $effect(() => {
        const currentParams = new URLSearchParams(window.location.search);
        
        // Sync Search Query
        if (appState.searchQuery) {
            currentParams.set('q', appState.searchQuery);
        } else {
            currentParams.delete('q');
        }

        // Sync Active Tab Path (more stable than index across refreshes)
        if (appState.activeTab?.path) {
            currentParams.set('tab', appState.activeTab.path);
        } else {
            currentParams.delete('tab');
        }

        const newSearch = currentParams.toString();
        const currentSearch = window.location.search.replace('?', '');
        
        if (newSearch !== currentSearch) {
            const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
            window.history.replaceState(null, '', newUrl);
        }
    });
}

/**
 * Call this after tabs are loaded to restore active tab from URL 'tab' parameter.
 */
export function restoreTabFromUrl() {
    const appState = getState();
    const params = new URLSearchParams(window.location.search);
    const tabPath = params.get('tab');

    if (tabPath && appState.tabs.length > 0) {
        const index = appState.tabs.findIndex(t => t.path === tabPath);
        if (index !== -1 && index !== appState.activeTabIndex) {
            selectTab(index);
        }
    }
}
