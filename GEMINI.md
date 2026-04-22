# HotPaste — AI-Agent Project Guide (UTF-8 with BOM)

Цей файл є головним входом для AI-агентів. Він описує архітектуру та правила розробки проекту.

## 🏗️ Архітектурна модель

Проект побудований на **Svelte 5** та **Tauri v2**. Використовується чіткий розподіл на шари:

1.  **Services (`src/lib/services/`):** Чиста логіка та API. Не містять стану. Взаємодіють з Tauri (Rust) або File System.
2.  **Stores/States (`src/lib/stores/`, `src/lib/states/`):** Реактивний стан на базі Svelte 5 Runes (`$state`, `$derived`). 
    *   `appState.svelte.ts` — головний фасад для UI.
    *   `uiState.svelte.ts` — стан інтерфейсу та модальних вікон.
    *   `fsState.svelte.ts` — стан файлової системи та синхронізація даних.
3.  **Components (`src/lib/components/`):** UI-компоненти. Використовують `getState()` з `appState` для доступу до даних.

## 🔄 Потік даних (Data Flow)

1.  **Завантаження:** `fsState` ініціює зчитування папок -> `tauriFileSystem` звертається до Rust -> дані повертаються та валідуються через `Zod` (схеми в `src/lib/schemas/`) -> стан оновлюється.
2.  **Взаємодія:** Користувач клікає/тисне клавішу -> `appState` викликає відповідний метод у `fsState` або `uiState` -> стан змінюється -> Svelte 5 автоматично оновлює UI.

## 🎹 Система гарячих клавіш

*   Програма підтримує два типи вкладок: `snippets` (текст) та `keyboard` (запуск програм).
*   Обробка клавіш централізована в `appState.svelte.ts` (`copyCardByHotkey`).
*   **Confirmation Logic:** Деякі дії вимагають багаторазового натискання (налаштовується через `confirmCount`). Стан модального вікна підтвердження зберігається в `uiState.activeActionConfirmation`.

## 🛠️ Правила розробки для AI

1.  **Runes Only:** Використовуй лише Svelte 5 Runes. Уникай Svelte 4 stores (`writable`).
2.  **Surgical Edits:** При зміні логіки завжди перевіряй `appState.svelte.ts`, оскільки він є точкою входу для більшості компонентів.
3.  **Validation:** Будь-які зміни в структурі даних `_hotpaste.json` ПОВИННІ бути відображені в `src/lib/schemas/config.ts`.
4.  **Logging:** Використовуй `logService` замість `console.log`. Перевіряй `logConfig` у `logService.svelte.ts` для налаштування дебагінгу.
5.  **UTF-8 BOM:** Усі `.md` файли мають бути в UTF-8 з BOM для Windows.
6.  **Testing:** Проєкт використовує Vitest для тестування (наприклад, `src/lib/schemas/config.test.ts`). При створенні нової логіки чи сервісів обов'язково пиши юніт-тести.
7.  **Local Storage:** Використовуй префікс `hotpaste_` для усіх ключів, що зберігаються в `localStorage` чи `sessionStorage`.

## 🚫 ЖОРСТКІ ОБМЕЖЕННЯ (ANTI-PATTERNS)

*   **НЕ використовуй Svelte 4 API:** Ніяких `writable`, `readable`, `derived` з `svelte/store`. Тільки `$state` і `$derived` з `svelte`.
*   **НЕ використовуй `<slot>`:** У Svelte 5 використовуй `{@render children()}` (Snippets).
*   **НЕ використовуй `on:click`:** Використовуй атрибути подій `onclick`.
*   **НЕ змінюй дані напряму без валідації:** Завжди пропускай дані через Zod схеми з `src/lib/schemas/`.
*   **НЕ зберігай дані без префікса:** Ніколи не використовуй `localStorage.setItem('config', ...)` без префікса `hotpaste_`.

## ✨ Приклади правильного коду

### 1. Компонент Svelte 5 (Runes)
```svelte
<script lang="ts">
  let { title, children } = $props();
  let count = $state(0);
  let doubled = $derived(count * 2);

  function increment() {
    count++;
  }
</script>

<div>
  <h1>{title}</h1>
  <button onclick={increment}>Count: {count} (Doubled: {doubled})</button>
  {@render children()}
</div>
```

### 2. Контролер (Стейт)
```typescript
// src/lib/states/myState.svelte.ts
export class MyState {
  value = $state("");

  constructor(initialValue: string = "") {
    this.value = initialValue;
  }

  updateValue(newValue: string) {
    this.value = newValue;
  }
}
export const myState = new MyState();
```

## 📁 Ключові файли

*   `src/lib/types.ts` — всі основні TypeScript інтерфейси.
*   `src-tauri/src/lib.rs` — бекенд на Rust (команди Tauri).
*   `src/lib/stores/appState.svelte.ts` — головний фасад (API для компонентів).
