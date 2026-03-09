use tauri::{AppHandle, Manager, WindowEvent, WebviewWindow};
use tauri::tray::{TrayIconBuilder, MenuItemBuilder, TrayIconEvent};
use tauri::menu::MenuBuilder;
use window_vibrancy::apply_mica;
use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::UI::WindowsAndMessaging::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::Foundation::LPARAM;

static WIN_PRESSED: AtomicBool = AtomicBool::new(false);
static OTHER_KEY_PRESSED: AtomicBool = AtomicBool::new(false);
static mut APP_HANDLE: Option<AppHandle> = None;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").expect("no main").show();
            let _ = app.get_webview_window("main").expect("no main").set_focus();
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_shortcut("Alt+Space").expect("invalid shortcut")
            .with_handler(|app, shortcut| {
                if shortcut.to_string() == "alt+space" {
                    toggle_window(app);
                }
            })
            .build()
        )
        .setup(|app| {
            let handle = app.handle().clone();
            unsafe { APP_HANDLE = Some(handle.clone()); }

            // Tray Menu items
            let show_item = MenuItemBuilder::with_id("show", "Show HotPaste").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            // Create System Tray
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => { toggle_window(app); }
                    "quit" => { std::process::exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            {
                let _ = apply_mica(&window, None);
            }

            // Hide on blur
            let win_handle = window.clone();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Focused(false) => {
                        let _ = win_handle.hide();
                    }
                    WindowEvent::CloseRequested { api, .. } => {
                        // Hide to tray instead of closing
                        api.prevent_close();
                        let _ = win_handle.hide();
                    }
                    _ => {}
                }
            });

            // Start Windows Keyboard Hook
            std::thread::spawn(|| unsafe {
                let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_keyboard_proc), 0, 0);
                let mut msg = std::mem::zeroed();
                while GetMessageW(&mut msg, 0, 0, 0) != 0 {
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
                UnhookWindowsHookEx(hook);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

unsafe extern "system" fn low_level_keyboard_proc(n_code: i32, w_param: usize, l_param: LPARAM) -> isize {
    if n_code == HC_ACTION as i32 {
        let kb_data = *(l_param as *const KBDLLHOOKSTRUCT);
        let vk_code = kb_data.vkCode as u32;

        match w_param as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                if vk_code == VK_LWIN as u32 || vk_code == VK_RWIN as u32 {
                    WIN_PRESSED.store(true, Ordering::SeqCst);
                    OTHER_KEY_PRESSED.store(false, Ordering::SeqCst);
                } else if WIN_PRESSED.load(Ordering::SeqCst) {
                    OTHER_KEY_PRESSED.store(true, Ordering::SeqCst);
                }
            }
            WM_KEYUP | WM_SYSKEYUP => {
                if vk_code == VK_LWIN as u32 || vk_code == VK_RWIN as u32 {
                    let was_pressed = WIN_PRESSED.swap(false, Ordering::SeqCst);
                    let other_pressed = OTHER_KEY_PRESSED.load(Ordering::SeqCst);

                    if was_pressed && !other_pressed {
                        if let Some(handle) = &APP_HANDLE {
                            toggle_window(handle);
                        }
                        return 1;
                    }
                }
            }
            _ => {}
        }
    }
    CallNextHookEx(0, n_code, w_param, l_param)
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    }
}
