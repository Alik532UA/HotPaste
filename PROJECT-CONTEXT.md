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
