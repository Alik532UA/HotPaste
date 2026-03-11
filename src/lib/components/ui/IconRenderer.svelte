<script lang="ts">
  import * as icons from "lucide-svelte";
  import type { ComponentType } from "svelte";
  import { iconService } from "../../services/iconService.svelte";
  
  interface Props {
    icon: string | null | undefined;
    size?: number | string;
    class?: string;
  }

  let { icon, size = 16, class: className = "" }: Props = $props();

  const isLucideStr = $derived(icon?.startsWith('lucide:'));
  const rawIconName = $derived(isLucideStr ? icon?.substring(7) : icon);

  function toPascalCase(str: string) {
    return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }

  const LucideIcon = $derived(
    (rawIconName && rawIconName.length > 2 && rawIconName.length <= 100 && !rawIconName.includes('/') && !rawIconName.includes(':'))
      ? ((icons[toPascalCase(rawIconName) as keyof typeof icons] || icons[rawIconName as keyof typeof icons]) as ComponentType | undefined) || null
      : null
  );

  let localUrl = $state<string | null>(null);

  $effect(() => {
    if (icon) {
        if (icon.startsWith('.private/')) {
            iconService.getLocalIconUrl(icon).then(url => {
                localUrl = url;
            });
        } else if (icon.startsWith('data:')) {
            localUrl = icon;
        } else if (icon.length > 100 && !icon.includes(' ') && !icon.includes(':')) {
            // Assume pure base64
            localUrl = `data:image/png;base64,${icon}`;
        } else {
            localUrl = null;
        }
    } else {
        localUrl = null;
    }
  });

  const isEmoji = $derived(icon && !LucideIcon && !localUrl && icon.length <= 4);

  const cssSize = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

{#if LucideIcon}
  <LucideIcon {size} class={className} />
{:else if localUrl}
  <img src={localUrl} alt="" style="width: {cssSize}; height: {cssSize}; object-fit: contain;" class={className} />
{:else if isEmoji}
  <span class={className} style="font-size: {cssSize}; line-height: 1;">{icon}</span>
{/if}
