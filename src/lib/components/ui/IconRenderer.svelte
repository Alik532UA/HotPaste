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
    if (!str) return '';
    return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }

  const LucideIcon = $derived.by(() => {
    if (!rawIconName || rawIconName.includes('/') || rawIconName.includes(':') || rawIconName.length > 100) return null;
    const name = toPascalCase(rawIconName);
    return (icons[name as keyof typeof icons] || icons[rawIconName as keyof typeof icons]) as ComponentType | undefined;
  });

  let localUrl = $state<string | null>(null);

  $effect(() => {
    if (!icon) {
        localUrl = null;
        return;
    }

    if (icon.startsWith('data:')) {
        localUrl = icon;
        return;
    }

    if (icon.startsWith('.assets/icons/')) {
        // Check cache first (synchronously if possible, though getLocalIconUrl is async)
        if (iconService.iconCache[icon]) {
            localUrl = iconService.iconCache[icon];
        } else {
            iconService.getLocalIconUrl(icon).then(url => {
                localUrl = url;
            });
        }
        return;
    }

    if (icon.length > 100 && !icon.includes(' ') && !icon.includes(':') && !icon.includes('/')) {
        localUrl = `data:image/png;base64,${icon}`;
        return;
    }

    localUrl = null;
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
