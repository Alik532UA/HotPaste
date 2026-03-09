use tauri::{AppHandle, Manager, WindowEvent};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use window_vibrancy::apply_mica;
use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::UI::WindowsAndMessaging::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::Foundation::LPARAM;

use std::sync::OnceLock;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn run_hook_worker() {
    // This function runs in a separate process with NO window and NO Tauri.
    // This is the most reliable way to capture the Win key on Windows.
    unsafe {
        let hook = SetWindowsHookExW(WH_KEYBOARD_LL, Some(low_level_keyboard_proc_worker), std::ptr::null_mut(), 0);
        let mut msg = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) != 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook);
    }
}

static WIN_PRESSED: AtomicBool = AtomicBool::new(false);
static OTHER_KEY_PRESSED: AtomicBool = AtomicBool::new(false);

unsafe extern "system" fn low_level_keyboard_proc_worker(n_code: i32, w_param: usize, l_param: LPARAM) -> isize {
    if n_code == HC_ACTION as i32 {
        let kb_data = *(l_param as *const KBDLLHOOKSTRUCT);
        let vk_code = kb_data.vkCode as u32;

        if (kb_data.flags & 0x10) != 0 {
            return CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param);
        }

        let is_win = vk_code == VK_LWIN as u32 || vk_code == VK_RWIN as u32;

        match w_param as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                if is_win {
                    WIN_PRESSED.store(true, Ordering::SeqCst);
                    OTHER_KEY_PRESSED.store(false, Ordering::SeqCst);
                } else if WIN_PRESSED.load(Ordering::SeqCst) {
                    // Any other key pressed while Win is down means it's a combination
                    OTHER_KEY_PRESSED.store(true, Ordering::SeqCst);
                }
            }
            WM_KEYUP | WM_SYSKEYUP => {
                if is_win {
                    let was_pressed = WIN_PRESSED.swap(false, Ordering::SeqCst);
                    let other_pressed = OTHER_KEY_PRESSED.load(Ordering::SeqCst);

                    if was_pressed && !other_pressed {
                        // It was a standalone Win key press.
                        // Poison the sequence ONLY NOW to prevent Start Menu.
                        keybd_event(0xFF, 0, 0, 0);
                        keybd_event(0xFF, 0, KEYEVENTF_KEYUP, 0);
                        
                        println!("TOGGLE");
                        
                        // Release Win for the system
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

#[tauri::command]
async fn launch_start_program(app: AppHandle, name: String) -> Result<(), String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let path = docs.join("HotPaste").join("start").join(name);
    
    if !path.exists() {
        return Err("File not found".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        // Use 'cmd /c start' to reliably open .lnk files on Windows
        let status = Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| e.to_string())?;
        log::info!("Program launched: {:?}", status);
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Fallback for other OS if needed (though start menu is currently Windows-centric)
        let _ = Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .invoke_handler(tauri::generate_handler![launch_start_program])
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                resize_to_90_percent(&window);
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.center();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle);

            // Tray Menu
            let show_item = MenuItemBuilder::with_id("show", "Show HotPaste").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;
            let tray_menu = menu.clone();

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => { toggle_window(app); }
                    "quit" => { std::process::exit(0); }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { button, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
                        match button {
                            tauri::tray::MouseButton::Left => { toggle_window(tray.app_handle()); }
                            tauri::tray::MouseButton::Right => {
                                if let Some(window) = tray.app_handle().get_webview_window("main") {
                                    let _ = window.popup_menu(&tray_menu);
                                }
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)?;

            let window = app.get_webview_window("main").unwrap();
            resize_to_90_percent(&window);
            let _ = window.show();
            let _ = window.center();

            #[cfg(target_os = "windows")]
            {
                let _ = apply_mica(&window, None);
            }

            // Sync visibility state
            let window_events = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_events.hide();
                }
            });

            // SPAWN THE WORKER PROCESS
            let current_exe = std::env::current_exe().unwrap();
            std::thread::spawn(move || {
                let mut child = Command::new(current_exe)
                    .arg("--hook-worker")
                    .stdout(Stdio::piped())
                    .spawn()
                    .expect("failed to spawn hook worker");

                let stdout = child.stdout.take().expect("failed to open stdout");
                let reader = BufReader::new(stdout);

                for line in reader.lines() {
                    if let Ok(content) = line {
                        if content.trim() == "TOGGLE" {
                            if let Some(handle) = APP_HANDLE.get() {
                                toggle_window(handle);
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            resize_to_90_percent(&window);
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    }
}

fn resize_to_90_percent(window: &tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let size = monitor.size();
        let new_width = (size.width as f64 * 0.9) as u32;
        let new_height = (size.height as f64 * 0.9) as u32;
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: new_width,
            height: new_height,
        }));
    }
}
