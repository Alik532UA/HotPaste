<script lang="ts">
  import { getState, closeIconPicker } from "../stores/appState.svelte";
  import { Search, Smile, Type, X } from "lucide-svelte";
  import * as LucideIcons from "lucide-svelte";
  import BaseModal from "./ui/BaseModal.svelte";
  import SearchInput from "./ui/SearchInput.svelte";
  import { t } from "../i18n";

  const appState = getState();
  const picker = $derived(appState.activeIconPicker);

  let searchQuery = $state("");
  let activeTab = $state<"lucide" | "emoji">("lucide");
  let activeLucideCategory = $state("all");
  let activeEmojiCategory = $state("smileys");

  const lucideIconNames = Object.keys(LucideIcons).filter(
    (name) => name !== "createLucideIcon" && name !== "default" && typeof (LucideIcons as any)[name] === "function"
  );

  const lucideCategories: Record<string, string[]> = {
    all: lucideIconNames,
    common: ["Star", "Heart", "Home", "Settings", "User", "Bell", "Search", "Check", "X", "Plus", "Minus", "Info", "HelpCircle"],
    ui: ["Layout", "Menu", "MoreHorizontal", "MoreVertical", "Maximize", "Minimize", "ExternalLink", "Share", "Trash", "Edit", "Copy", "Link"],
    files: ["File", "Files", "Folder", "FolderOpen", "FileText", "Image", "Music", "Video", "Archive", "Save", "Cloud", "Download", "Upload"],
    device: ["Monitor", "Smartphone", "Tablet", "Laptop", "Watch", "Tv", "Speaker", "Mic", "Camera", "Battery", "Wifi", "Bluetooth", "Mouse"],
    arrows: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ChevronUp", "ChevronDown", "ChevronLeft", "ChevronRight", "RefreshCw", "RotateCcw"],
    nature: ["Sun", "Moon", "Cloud", "Zap", "Flame", "Droplets", "Wind", "Trees", "Leaf", "Flower2", "Bird", "Bug"],
    tools: ["Tool", "Hammer", "Wrench", "Screwdriver", "Cog", "Scissors", "Pencil", "Pen", "Eraser", "Brush", "Palette", "Key"],
  };

  const emojiCategories: Record<string, string[]> = {
    smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😻", "😼", "😽", "🙀", "😿", "😾"],
    gestures: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👣", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"],
    people: ["👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "👮", "🕵️", "💂", "🥷", "👷", "🤴", "👸", "👳", "👲", "🧕", "🤵", "👰", "🤰", "🤱", "👼", "🎅", "🤶", "🦸", "🦹", "🧙", "🧚", "🧛", "🧜", "🧝", "🧞", "🧟", "🚶", "🏃", "💃", "🕺", "🕴️", "👯", "🧗"],
    animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷️", "🕸️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊"],
    nature: ["🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍", "🪴", "🎋", "🍃", "🍂", "🍁", "🍄", "🌾", "💐", "🌷", "🌹", "🥀", "🌺", "🌸", "🌼", "🌻", "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓", "🌔", "🌙", "🌎", "🌍", "🌏", "🪐", "💫", "⭐️", "🌟", "✨", "⚡️", "☄️", "💥", "🔥", "🌪️", "🌈", "☀️", "🌤️", "⛅️", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "❄️", "☃️", "⛄️", "🌬️", "💨", "💧", "💦", "☔️", "☂️", "🌊"],
    food: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🥗", "🥘", "🥣", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🍤", "🍙", "🍚", "🍘", "🍥", "🍦", "🥧", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "☕️", "🍵", "🥤"],
    activities: ["⚽️", "🏀", "🏈", "⚾️", "🥎", "🎾", "🏐", "🏉", "🎱", "🪄", "🪅", "🪁", "🎯", "⛳️", "🏹", "🎣", "🤿", "🥊", "🥋", "⛸️", "🎿", "🛷", "🎮", "🕹️", "🎰", "🎲", "🧩", "🧸", "♠️", "♥️", "♦️", "♣️", "♟️", "🎭", "🖼️", "🎨", "🧵", "🪡", "🧶", "🪢"],
    objects: ["⌚️", "📱", "📲", "💻", "⌨️", "🖱️", "🖲️", "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "🧭", "⏰", "🕰️", "⌛️", "⏳", "📡", "🔋", "🔌", "💡", "🔦", "🕯️", "🧯", "💸", "💵", "💴", "💶", "💷", "🪙", "💰", "💳", "💎", "⚖️", "🧰", "🔧", "🔨", "⚒️", "🛠️", "⛏️", "🪚", "🔩", "⚙️", "🧱", "⛓️", "🧲", "🔫", "💣", "🧨", "🪓", "🔪", "🗡️", "⚔️", "🛡️", "🚬", "⚰️", "🪦", "🏺", "🔮", "📿", "🧿", "💈", "⚗️", "🔬", "🩹", "🩺", "💊", "💉", "🩸", "🧬", "🧹", "🧺", "🧻", "🚽", "🚰", "🚿", "🛁", "🛀", "🧼", "🪥", "🪒", "🧽", "🪣", "🧴", "🛎️", "🔑", "🗝️", "🚪", "🪑", "🛋️", "🛏️", "🛌", "🎁", "🎈", "🎏", "🎀", "🎊", "🎉", "🧧", "✉️", "📩", "📨", "📧", "💌", "📥", "📤", "📦", "🏷️", "🪧", "🚚", "🚛", "🚜", "🏎️", "🏍️", "🛵", "🚲", "🛴", "🛹", "🛼", "⛽️", "🚨", "🚥", "🚦", "🛑", "🚧", "⚓️", "⛵️", "🛶", "🚤", "🚢", "✈️", "🚀", "🛸", "🧳"],
    symbols: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️", "✡️", "☯️", "☦️", "🛐", "⛎", "♈️", "♉️", "♊️", "♋️", "♌️", "♍️", "♎️", "♏️", "♐️", "♑️", "♒️", "♓️", "🆔", "⚛️", "☢️", "☣️", "📴", "📳", "🈶", "🈚️", "✴️", "🆚", "💮", "🉐", "㊙️", "㊗️", "🅰️", "🅱️", "🆎", "🆑", "🅾️", "🆘", "❌", "⭕️", "🛑", "⛔️", "📛", "🚫", "💯", "💢", "♨️", "❗️", "❕", "❓", "❔", "‼️", "⁉️", "⚠️", "🔱", "⚜️", "🔰", "♻️", "✅", "🌐", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿️", "🅿️", "🛗", "🛂", "🛃", "🛄", "🛅", "🚹", "🚺", "🚼", "⚧️", "🚻", "🚮", "📶", "ℹ️", "🔤", "🔡", "🔠", "🆗", "🆙", "🆒", "🆕", "🆓", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "▶️", "⏸️", "⏹️", "⏺️", "⏭️", "⏮️", "⏩", "⏪", "⏫", "⏬", "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️", "↕️", "↔️", "🔄", "🎵", "🎶", "➕", "➖", "➗", "✖️", "♾️", "💲", "™️", "©️", "®️", "✔️", "☑️", "🔘", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫️", "⚪️", "🟤", "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "▪️", "▫️", "⬛️", "⬜️", "📁", "📂", "📅", "📆", "🗒️", "🗓️", "📈", "📉", "📊", "📋", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🗑️"],
    flags: ["🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇦🇺", "🇦🇹", "🇧🇪", "🇧🇷", "🇨🇦", "🇨🇭", "🇨🇳", "🇩🇪", "🇩🇰", "🇪🇸", "🇪🇺", "🇫🇮", "🇫🇷", "🇬🇧", "🇬🇷", "🇭🇰", "🇭🇺", "🇮🇩", "🇮🇪", "🇮🇱", "🇮🇳", "🇮🇹", "🇯🇵", "🇰🇷", "🇲🇽", "🇳🇱", "🇳🇴", "🇳🇿", "🇵🇱", "🇵🇹", "🇸🇪", "🇸🇬", "🇹🇷", "🇺🇦", "🇺🇸", "🇻🇳"]
  };

  // Performance optimization: limit initial rendering to 200 items
  const MAX_DISPLAY = 200;

  const filteredLucide = $derived(
    searchQuery.trim() === "" 
      ? (activeLucideCategory === "all" 
          ? lucideIconNames.slice(0, MAX_DISPLAY) 
          : (lucideCategories[activeLucideCategory] || []))
      : lucideIconNames.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, MAX_DISPLAY)
  );

  const filteredEmojis = $derived(
    searchQuery.trim() === ""
      ? (emojiCategories[activeEmojiCategory] || [])
      : Object.values(emojiCategories).flat().filter(e => e.includes(searchQuery)).slice(0, MAX_DISPLAY)
  );

  function handleSelect(icon: string) {
    if (picker) {
      picker.onSelect(icon);
      closeIconPicker();
    }
  }

  function handleClose() {
    closeIconPicker();
  }
</script>

<BaseModal 
  isOpen={!!picker} 
  onClose={handleClose}
  title={picker?.title || t.cards.icon}
  zIndex={3000}
  maxWidth="600px"
  testId="icon-picker-modal"
>
  <div class="picker-container">
    <!-- Main Tabs -->
    <div class="tabs">
      <button 
        class="tab-btn" 
        class:active={activeTab === "lucide"} 
        onclick={() => { activeTab = "lucide"; searchQuery = ""; }}
      >
        <Search size={16} />
        Lucide
      </button>
      <button 
        class="tab-btn" 
        class:active={activeTab === "emoji"} 
        onclick={() => { activeTab = "emoji"; searchQuery = ""; }}
      >
        <Smile size={16} />
        Emoji
      </button>
    </div>

    <!-- Search -->
    <SearchInput 
      bind:value={searchQuery} 
      testId="icon-search-input"
    />

    <!-- Sub-tabs (Categories) -->
    {#if searchQuery.trim() === ""}
      <div class="sub-tabs-scroll">
        <div class="sub-tabs">
          {#if activeTab === "lucide"}
            {#each Object.keys(lucideCategories) as cat}
              <button 
                class="sub-tab-btn" 
                class:active={activeLucideCategory === cat}
                onclick={() => activeLucideCategory = cat}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            {/each}
          {:else}
            {#each Object.keys(emojiCategories) as cat}
              <button 
                class="sub-tab-btn" 
                class:active={activeEmojiCategory === cat}
                onclick={() => activeEmojiCategory = cat}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}

    <!-- Content -->
    <div class="icons-grid-scroll">
      {#if activeTab === "lucide"}
        <div class="icons-grid">
          {#each filteredLucide as name}
            {@const IconComp = (LucideIcons as any)[name]}
            <button 
              class="icon-item" 
              class:selected={picker?.current === name}
              onclick={() => handleSelect(name)}
              title={name}
            >
              {#if IconComp}
                <IconComp size={24} />
              {/if}
              <span class="icon-name">{name}</span>
            </button>
          {/each}
        </div>
        {#if filteredLucide.length === 0}
          <div class="empty-state">{t.common.empty}</div>
        {/if}
      {:else}
        <div class="emoji-grid">
          {#each filteredEmojis as emoji}
            <button 
              class="emoji-item" 
              class:selected={picker?.current === emoji}
              onclick={() => handleSelect(emoji)}
            >
              {emoji}
            </button>
          {/each}
        </div>
        {#if filteredEmojis.length === 0}
          <div class="empty-state">{t.common.empty}</div>
        {/if}
      {/if}
    </div>
  </div>
</BaseModal>

<style>
  .picker-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 550px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    padding: 4px;
    background: var(--color-surface-1);
    border-radius: 12px;
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: 0.9rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn.active {
    background: var(--color-bg-secondary);
    color: var(--color-accent-violet);
    box-shadow: var(--shadow-sm);
  }

  .sub-tabs-scroll {
    overflow-x: auto;
    scrollbar-width: none;
    margin: 0 -4px;
    padding: 0 4px;
  }

  .sub-tabs-scroll::-webkit-scrollbar { display: none; }

  .sub-tabs {
    display: flex;
    gap: 6px;
    padding-bottom: 4px;
  }

  .sub-tab-btn {
    white-space: nowrap;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-1);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sub-tab-btn:hover {
    background: var(--color-surface-2);
    border-color: var(--color-accent-violet);
  }

  .sub-tab-btn.active {
    background: var(--color-accent-violet);
    color: white;
    border-color: var(--color-accent-violet);
  }

  .icons-grid-scroll {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .icons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
    gap: 8px;
  }

  .icon-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 8px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--color-text-secondary);
  }

  .icon-item:hover {
    background: var(--color-surface-2);
    border-color: var(--color-accent-violet);
    color: var(--color-accent-violet);
    transform: translateY(-2px);
  }

  .icon-item.selected {
    background: color-mix(in srgb, var(--color-accent-violet) 10%, transparent);
    border-color: var(--color-accent-violet);
    color: var(--color-accent-violet);
  }

  .icon-name {
    font-size: 0.65rem;
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.8;
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(54px, 1fr));
    gap: 8px;
  }

  .emoji-item {
    font-size: 1.8rem;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-1);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .emoji-item:hover {
    background: var(--color-surface-2);
    transform: scale(1.1);
  }

  .emoji-item.selected {
    background: color-mix(in srgb, var(--color-accent-violet) 10%, transparent);
    border-color: var(--color-accent-violet);
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
