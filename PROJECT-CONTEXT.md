# HotPaste — Project Context

## 1. Профіль і хостинг

- **Профіль**: Desktop / Web SPA (Tauri 2 + Svelte 5 + Vite).
- **Хостинг**: GitHub Pages + Desktop App (Windows/Linux/macOS).
- **Стек**: Svelte 5 (Runes), Vite, Tailwind-free Vanilla CSS, VitePWA (`registerType: 'prompt'`).

## 2. Модель версіонування (VERSIONING-v10 § 1 & § 2)

- **Модель бампа**: `npm version <patch|minor|major> --no-git-tag-version` (Версія на реліз).
- **Впровадження версії**: константа `__APP_VERSION__` інжектується через Vite define.
- **Оновлення клієнта**: VitePWA з `ReloadPrompt` запобігає втраті відкритих даних.

## 3. CI/CD та дозволи релізів (CI-CD-AND-TOOLS § 1.1)

- **Метод деплою**: OIDC GitHub Pages для вебу; окремий реліз-job `tauri-action` у workflow випуску десктопних бінарників.
- **Виняток прав**: `contents: write` застосовується виключно в релізному job'і збірки та прикріплення артефактів Tauri (записаний виняток CI-CD-AND-TOOLS § 1.1).

## 4. Сховище (STORAGE-NAMESPACE-v10 § 1)

- **PROJECT_PREFIX**: `hotpaste_`.

## Реєстр префіксів на спільному origin

Реєстр префіксів браузерного сховища (`localStorage` / `sessionStorage`) на спільному origin (`alik532ua.github.io`). Жоден префікс не є початком іншого (STORAGE-NAMESPACE-v10).

| Проєкт               | Префікс (prod)      | Префікс (dev)           | Призначення                      |
| -------------------- | ------------------- | ----------------------- | -------------------------------- |
| adoptananimal        | `adoptananimal_`    | `adoptananimal-dev_`    | Притулок для тварин              |
| VetCrewEmergency     | `vetcrewemergency_` | `vetcrewemergency-dev_` | Невідкладна ветеринарна допомога |
| VetCrewGames         | `vetcrewgames_`     | `vetcrewgames-dev_`     | Навчальні ветеринарні ігри       |
| DigitalWorkshop      | `digitalworkshop_`  | `digitalworkshop-dev_`  | Цифрова майстерня                |
| MindStep             | `mindstep_`         | `mindstep-dev_`         | Психологічний супровід           |
| Slovko               | `slovko_`           | `slovko-dev_`           | Гра в слова                      |
| CV                   | `cv-svelte_`        | `cv-svelte-dev_`        | Резюме та портфоліо              |
| as5.odesa.ua         | `as5.odesa.ua_`     | `as5.odesa.ua-dev_`     | Автостанція Одеса 5              |
| teatralo4ka.odesa.ua | `teatralo4ka_`      | `teatralo4ka-dev_`      | Театралочка Одеса                |
| HotPaste             | `hotpaste_`         | `hotpaste-dev_`         | Швидка вставка та нотатки        |
| AudioRemote          | `audioremote_`      | `audioremote-dev_`      | Аудіодошка та пульт керування    |
| DeviantBlaze         | `deviantblaze_`     | `deviantblaze-dev_`     | Медіа та графіка                 |
