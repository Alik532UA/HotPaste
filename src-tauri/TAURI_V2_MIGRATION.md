---
title: Міграція на Tauri 2.0 та виправлення Rust-частини
description: Технічна нотатка про оновлення конфігурації та коду для сумісності з Tauri 2.0 та новими версіями Windows API.
status: 100%
type: technical-note
date: 2026-03-09
---

### 🚀 Загальний огляд
Проєкт HotPaste успішно адаптовано до **Tauri 2.0**. Виправлено критичні помилки компіляції, пов'язані з невідповідністю типів у `windows-sys` та змінами в API плагінів Tauri.

### 🛠️ Що було зроблено

#### 1. Оновлення конфігурації (Cargo.toml)
- Увімкнено функцію `tray-icon` для пакету `tauri`.
- Додано необхідні системні бібліотеки для роботи з Windows API.

#### 2. Виправлення коду (src-tauri/src/lib.rs)
- **Global Shortcut:** Оновлено сигнатуру обробника (`with_handler`), який тепер приймає 3 аргументи: `|app, shortcut, event|`.
- **System Tray:** Виправлено імпорт `MenuItemBuilder` (тепер з `tauri::menu`) та додано явну типізацію для `TrayIcon`.
- **Windows API:** Виправлено типи дескрипторів. У нових версіях `windows-sys` (0.59+) замість `0` для `HWND`, `HHOOK` та інших handle-типів необхідно використовувати `std::ptr::null_mut()`.
- **Безпека (Refactoring):** Небезпечну конструкцію `static mut APP_HANDLE` замінено на безпечний `std::sync::OnceLock`. Це усунуло попередження компілятора та зробило доступ до `AppHandle` потокобезпечним.

### 📦 Поточні залежності (Rust)
Згідно з `cargo tree --depth 1`:
- `tauri v2.10.3` (features: `tray-icon`)
- `tauri-plugin-autostart v2.5.1`
- `tauri-plugin-global-shortcut v2.3.1`
- `tauri-plugin-log v2.8.0`
- `tauri-plugin-single-instance v2.4.0`
- `window-vibrancy v0.5.3`
- `windows-sys v0.59.0`

### 💡 Рекомендації для подальшої розробки
- **Win Key Hook:** Поточна реалізація через `SetWindowsHookExW` залишена без змін, оскільки вона дозволяє перехоплювати натискання клавіші Win без відкриття меню "Пуск", що складно реалізувати через стандартний `global-shortcut`.
- **Логування:** Використовуйте `tauri-plugin-log` для дебагінгу Rust-частини.

---
*Документація створена автоматично Gemini CLI.*
