//! КОРІНЬ — ЛИШЕ ЗБІРКА ЗАСТОСУНКУ.
//!
//! Доти цей файл був 1195 рядків і тримав усе одразу: низькорівневий гак
//! клавіатури, Win32-регіони для заокруглених кутів, витяг іконок через
//! PowerShell, переліки процесів, запуск ярликів і саму збірку. Читати його
//! доводилося цілком, щоб змінити будь-що, а найгостріше місце застосунку —
//! запуск довільних програм із рядка, що прийшов із вебвʼю, — губилося
//! посеред коду про заокруглення кутів.
//!
//! Тепер кожна відповідальність має свій файл, і межа видима з переліку:
//!
//!   * [`launch`] — запуск ярликів. Найгостріше: рядок приходить іззовні;
//!   * [`paths`] — провідник і `canonicalize` як межа теки проєкту;
//!   * [`shortcuts`] — переліки процесів, меню «Пуск», застосунків;
//!   * [`icons`] — витяг і кеш значків;
//!   * [`window`] — форма вікна, кути, режими;
//!   * [`hook`] — гаряча клавіша окремим процесом;
//!   * [`state`] — спільний стан машини.
//!
//! Поділ зроблено ПЕРЕНОСОМ, байт у байт: жодне тіло функції не переписане,
//! тож поведінка змінитися не могла. Змінилася лише видимість — усе, що
//! тепер кличуть із сусіднього модуля, стало `pub(crate)`.

mod hook;
mod icons;
mod launch;
mod paths;
mod shortcuts;
mod state;
mod window;

use hook::{kill_hook_worker, restart_hook_worker_tauri};
use icons::{clear_icon_cache, get_shortcut_icon, get_shortcut_icons_batch, save_icon};
use launch::{launch_program_by_path, launch_start_program};
use paths::{open_local_shortcuts_folder, reveal_in_project};
use shortcuts::{
    get_local_shortcuts, get_running_processes, get_system_apps, get_system_shortcuts,
};
use state::{APP_HANDLE, CREATE_NO_WINDOW, HOOK_CHILD, IS_MINIMAL};
use window::{
    hide_window, open_devtools, resize_to_90_percent, resize_to_minimal, set_minimal_mode_tauri,
    set_rounded_corners, toggle_window,
};

use std::io::{BufRead, BufReader};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::atomic::Ordering;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

/// Гак клавіатури як окремий процес — точка входу для `--hook-worker`.
pub use hook::run_hook_worker;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        /*
         * Плагін оновлення реєструється ЗАВЖДИ, а налаштований — не завжди.
         *
         * Адреси й відкритий ключ приходять із `tauri.conf.release.json`, який
         * накладається лише в релізній збірці. У збірці з дерева розробника
         * їх немає, і `check()` віддає помилку — це нормальний стан, а не
         * поломка: фронтенд ловить її й тихо переходить на свій старий шлях
         * (`app-version.json`), тобто просто каже, що версія нова, і не
         * вдає, ніби вміє її поставити.
         *
         * Реєструвати умовно було б гірше: різниця між збірками стала б
         * різницею в НАБОРІ КОМАНД, і виклик із фронтенда падав би з «unknown
         * command», що читається як зламаний застосунок.
         */
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            launch_program_by_path,
            launch_start_program,
            get_running_processes,
            get_system_shortcuts,
            get_local_shortcuts,
            get_system_apps,
            get_shortcut_icon,
            get_shortcut_icons_batch,
            clear_icon_cache,
            set_minimal_mode_tauri,
            hide_window,
            restart_hook_worker_tauri,
            reveal_in_project,
            save_icon,
            open_local_shortcuts_folder,
            open_devtools
        ])
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.center();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle);
            let product_name = app
                .config()
                .product_name
                .clone()
                .unwrap_or_else(|| "HotPaste".to_string());

            let show_text = format!("Show {}", product_name);
            let show_item = MenuItemBuilder::with_id("show", &show_text)
                .build(app)
                .expect("f");
            let quit_item = MenuItemBuilder::with_id("quit", "Quit")
                .build(app)
                .expect("f");
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()
                .expect("f");
            let tray_menu = menu.clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip(&product_name)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        toggle_window(app);
                    }
                    "quit" => {
                        kill_hook_worker();
                        app.cleanup_before_exit();
                        #[cfg(target_os = "windows")]
                        std::process::exit(0);
                        #[cfg(not(target_os = "windows"))]
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        match button {
                            tauri::tray::MouseButton::Left => {
                                toggle_window(tray.app_handle());
                            }
                            tauri::tray::MouseButton::Right => {
                                if let Some(window) = tray.app_handle().get_webview_window("main") {
                                    let _ = window.popup_menu(&tray_menu);
                                }
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)
                .expect("f");

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&product_name);

                if IS_MINIMAL.load(Ordering::SeqCst) {
                    resize_to_minimal(&window);
                } else {
                    resize_to_90_percent(&window);
                }
                let _ = window.show();
                let _ = window.center();
                #[cfg(target_os = "windows")]
                {
                    let _ = window.set_shadow(false);
                    set_rounded_corners(&window);
                }
                let window_events = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window_events.hide();
                    }
                    WindowEvent::Destroyed => {
                        kill_hook_worker();
                    }
                    WindowEvent::Resized(_) => {
                        #[cfg(target_os = "windows")]
                        set_rounded_corners(&window_events);
                    }
                    _ => {}
                });
            }

            let current_exe = std::env::current_exe().unwrap();
            std::thread::spawn(move || {
                let mut cmd = Command::new(current_exe);
                cmd.arg("--hook-worker")
                    .stdout(Stdio::piped())
                    .creation_flags(CREATE_NO_WINDOW);
                /*
                 * `wait()` тут немає навмисно, і clippy про це попереджає
                 * справедливо — але вихід із цього процесу не є подією, на
                 * яку варто чекати. Гак живе рівно стільки, скільки живе
                 * застосунок; його дескриптор кладеться в `HOOK_CHILD`, і
                 * вбиває процес `kill_hook_worker()` — на закритті вікна й на
                 * виході з трея. Чекати на нього в цьому потоці означало б
                 * тримати ще один живий потік до кінця роботи заради коду
                 * виходу, який нікого не цікавить.
                 */
                #[allow(clippy::zombie_processes)]
                let mut child = cmd.spawn().expect("f");
                let stdout = child.stdout.take().expect("f");
                if let Ok(mut lock) = HOOK_CHILD.lock() {
                    *lock = Some(child);
                }
                let reader = BufReader::new(stdout);
                for content in reader.lines().map_while(Result::ok) {
                    if content.trim() == "TOGGLE" {
                        if let Some(handle) = APP_HANDLE.get() {
                            toggle_window(handle);
                        }
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("e");
}
