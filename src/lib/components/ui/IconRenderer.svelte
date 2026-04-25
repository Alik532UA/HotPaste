<script lang="ts">
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

  // Pascal to kebab
  function toKebabCase(str: string) {
    if (!str) return '';
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  let LucideIcon = $state<ComponentType | null>(null);
  let localUrl = $state<string | null>(null);

  $effect(() => {
    LucideIcon = null;
    localUrl = null;

    if (!icon) return;

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

    if (rawIconName && !rawIconName.includes('/') && !rawIconName.includes(':') && rawIconName.length > 2 && rawIconName.length <= 100) {
        const kebabName = toKebabCase(rawIconName);
        
        // Use eager: false to load as separate chunks. 
        // Vite knows how to resolve 'lucide-svelte/dist/icons/*.js'
        const icons = import.meta.glob('/node_modules/lucide-svelte/dist/icons/*.js');
        const path = `/node_modules/lucide-svelte/dist/icons/${kebabName}.js`;
        
        if (icons[path]) {
            icons[path]().then((module: any) => {
                LucideIcon = module.default || module;
            }).catch((err) => {
                console.error(`Failed to load icon: ${kebabName}`, err);
            });
        } else {
            // If the absolute path doesn't work, try to debug
            // console.warn(`Icon path not found in glob: ${path}`);
        }
    }
  });

  const isEmoji = $derived(icon && !LucideIcon && !localUrl && icon.length <= 4);
  const cssSize = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

{#if LucideIcon}
  <LucideIcon {size} class={className} />
{:else if localUrl}
  <img src={localUrl} alt="" loading="lazy" style="width: {cssSize}; height: {cssSize}; object-fit: contain;" class={className} />
{:else if isEmoji}
  <span class={className} style="font-size: {cssSize}; line-height: 1;">{icon}</span>
{/if}
