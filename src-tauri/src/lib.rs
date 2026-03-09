use tauri::{AppHandle, Manager, WindowEvent};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, TrayIcon};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use window_vibrancy::apply_mica;
use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::UI::WindowsAndMessaging::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::Foundation::LPARAM;

use std::sync::OnceLock;

static WIN_PRESSED: AtomicBool = AtomicBool::new(false);
static OTHER_KEY_PRESSED: AtomicBool = AtomicBool::new(false);
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

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
            .with_handler(|app, shortcut, _event| {
                if shortcut.to_string() == "alt+space" {
                    toggle_window(app);
                }
            })
            .build()
        )
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle);

            // Tray Menu items
            let show_item = MenuItemBuilder::with_id("show", "Show HotPaste").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            // Create System Tray
            let tray_menu = menu.clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => { 
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.center();
                        }
                    }
                    "quit" => { std::process::exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(move |tray: &TrayIcon, event| {
                    if let TrayIconEvent::Click { button, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
                        match button {
                            tauri::tray::MouseButton::Left => {
                                toggle_window(tray.app_handle());
                            }
                            tauri::tray::MouseButton::Right => {
                                if let Some(window) = tray.app_handle().get_webview_window("main") {
                                    // Pop up the menu at the current cursor position
                                    let _ = window.popup_menu(&tray_menu);
                                }
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)?;

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            {
                let _ = apply_mica(&window, None);
            }

            // Hide on blur (Temporarily disabled for UI development)
            /*
            let win_handle = window.clone();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Focused(false) => {
                        let _ = win_handle.hide();
                    }
                    _ => {}
                }
            });
            */

            // Still handle close request to hide to tray
            let win_handle_close = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_handle_close.hide();
                }
            });

            // Start Windows Keyboard Hook
            std::thread::spawn(|| unsafe {
                let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_keyboard_proc), std::ptr::null_mut(), 0);
                let mut msg = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) != 0 {
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

        // Ignore programmatically injected events (like our 0xFF dummy key)
        // LLKHF_INJECTED = 0x10
        if (kb_data.flags & 0x10) != 0 {
            return CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param);
        }

        match w_param as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                if vk_code == VK_LWIN as u32 || vk_code == VK_RWIN as u32 {
                    WIN_PRESSED.store(true, Ordering::SeqCst);
                    OTHER_KEY_PRESSED.store(false, Ordering::SeqCst);

                    // Send a dummy key press/release (0xFF). Windows sees "Win + 0xFF"
                    // and cancels the Start Menu opening.
                    keybd_event(0xFF, 0, 0, 0);
                    keybd_event(0xFF, 0, KEYEVENTF_KEYUP, 0);
                } else if WIN_PRESSED.load(Ordering::SeqCst) {
                    OTHER_KEY_PRESSED.store(true, Ordering::SeqCst);
                }
            }
            WM_KEYUP | WM_SYSKEYUP => {
                if vk_code == VK_LWIN as u32 || vk_code == VK_RWIN as u32 {
                    let was_pressed = WIN_PRESSED.swap(false, Ordering::SeqCst);
                    let other_pressed = OTHER_KEY_PRESSED.load(Ordering::SeqCst);

                    if was_pressed && !other_pressed {
                        if let Some(handle) = APP_HANDLE.get() {
                            toggle_window(handle);
                        }
                        
                        // Send 0xFF again on KeyUp to be 100% sure
                        keybd_event(0xFF, 0, 0, 0);
                        keybd_event(0xFF, 0, KEYEVENTF_KEYUP, 0);

                        // Release the Win key
                        keybd_event(vk_code as u8, 0, KEYEVENTF_KEYUP, 0);
                        
                        return 1;
                    }
                }
            }
            _ => {}
        }
    }
    CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param)
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
