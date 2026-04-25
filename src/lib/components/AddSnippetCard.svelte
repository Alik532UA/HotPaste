<script lang="ts">
  import { Plus } from "lucide-svelte";
  import { startNewCardCreation, getState } from "../stores/appState.svelte";
  import { t } from "../i18n";

  interface Props {
    subfolder: string | null;
  }

  let { subfolder }: Props = $props();
  const appState = getState();

  function handleClick() {
    startNewCardCreation(subfolder === 'Root' ? null : subfolder);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="add-card snippet-card interactive" 
  onclick={handleClick}
  title={t.tabs.emptyHint}
  data-testid="add-snippet-card-{subfolder || 'root'}"
>
  <div class="add-content">
    <div class="plus-icon">
      <Plus size={32} />
    </div>
    <span class="add-text">{t.common.add}</span>
  </div>
</div>

<style>
  .add-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(120px * var(--scale, 1));
    border: 2px dashed var(--color-border);
    background: color-mix(in srgb, var(--color-surface-1) 50%, transparent);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 12px;
  }

  .add-card:hover {
    border-color: var(--color-accent-violet);
    background: color-mix(in srgb, var(--color-accent-violet) 5%, transparent);
    color: var(--color-accent-violet);
    transform: translateY(-2px);
  }

  .add-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .plus-icon {
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .add-card:hover .plus-icon {
    opacity: 1;
  }

  .add-text {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
