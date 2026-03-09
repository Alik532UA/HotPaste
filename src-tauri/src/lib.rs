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
static IS_MINIMAL: AtomicBool = AtomicBool::new(false);

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
    launch_program_by_path(path.to_string_lossy().to_string()).await
}

#[tauri::command]
async fn launch_program_by_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
        log::info!("Program launched: {:?}", status);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(serde::Serialize, Clone)]
struct ShortcutInfo {
    name: String,
    path: String,
    icon: Option<String>,
}

#[tauri::command]
async fn get_running_processes() -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object {
                    try {
                        $p = $_.Path;
                        if (!$p) { $p = $_.MainModule.FileName }
                        if ($p) { [PSCustomObject]@{ Name=$_.Name; Path=$p; Icon=$null } }
                    } catch { }
                 } | ConvertTo-Json"
            ])
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(vec![]) }
}

#[tauri::command]
async fn get_system_shortcuts() -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-ChildItem -Path @(\"$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs\", \"$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\") -Filter *.lnk -Recurse | ForEach-Object {
                    [PSCustomObject]@{ Name=$_.BaseName; Path=$_.FullName; Icon=$null }
                } | ConvertTo-Json"
            ])
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(vec![]) }
}

#[tauri::command]
async fn get_local_shortcuts(app: AppHandle) -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let docs = app.path().document_dir().map_err(|e| e.to_string())?;
        let start_path = docs.join("HotPaste").join("start");
        
        if !start_path.exists() {
            std::fs::create_dir_all(&start_path).map_err(|e| e.to_string())?;
            return Ok(vec![]);
        }

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                format!(
                    "Get-ChildItem -Path '{}' -Recurse | Where-Object {{ $_.Extension -match 'lnk|exe' }} | ForEach-Object {{
                        [PSCustomObject]@{{ Name=$_.BaseName; Path=$_.FullName; Icon=$null }}
                     }} | ConvertTo-Json",
                    start_path.to_string_lossy()
                ).as_str()
            ])
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(vec![]) }
}

#[tauri::command]
async fn get_shortcut_icon(path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                format!(
                    "Add-Type -AssemblyName System.Drawing;
                     $p = '{}';
                     $t = $p;
                     try {{
                        if ($p -like '*.lnk') {{
                            $s = New-Object -ComObject WScript.Shell;
                            $l = $s.CreateShortcut($p);
                            if ($l.TargetPath) {{ 
                                $expanded = $s.ExpandEnvironmentStrings($l.TargetPath);
                                if ([System.IO.File]::Exists($expanded)) {{ $t = $expanded }}
                            }}
                        }}
                        $i = [System.Drawing.Icon]::ExtractAssociatedIcon($t);
                        $m = New-Object System.IO.MemoryStream;
                        $i.ToBitmap().Save($m, [System.Drawing.Imaging.ImageFormat]::Png);
                        [Convert]::ToBase64String($m.ToArray());
                     }} catch {{
                        try {{
                            # Absolute fallback to original path
                            $i = [System.Drawing.Icon]::ExtractAssociatedIcon($p);
                            $m = New-Object System.IO.MemoryStream;
                            $i.ToBitmap().Save($m, [System.Drawing.Imaging.ImageFormat]::Png);
                            [Convert]::ToBase64String($m.ToArray());
                        }} catch {{ 
                            # Silence all errors for cleaner output
                        }}
                     }}",
                    path.replace("'", "''")
                ).as_str()
            ])
            .output()
            .map_err(|e| e.to_string())?;

        let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if result.is_empty() {
            log::warn!("Failed to extract icon for path: {}", path);
            return Err("Failed to extract icon".to_string());
        }
        Ok(result)
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Not supported".to_string()) }
}

fn parse_shortcuts_json(stdout: Vec<u8>) -> Result<Vec<ShortcutInfo>, String> {
    let json_str = String::from_utf8_lossy(&stdout);
    if json_str.trim().is_empty() {
        return Ok(vec![]);
    }

    let v: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
    let mut shortcuts = Vec::new();

    let items = if let Some(array) = v.as_array() {
        array.clone()
    } else {
        vec![v]
    };

    for item in items {
        if let (Some(name), Some(path)) = (item["Name"].as_str(), item["Path"].as_str()) {
            shortcuts.push(ShortcutInfo {
                name: name.to_string(),
                path: path.to_string(),
                icon: None,
            });
        }
    }

    Ok(shortcuts)
}

#[tauri::command]
async fn set_minimal_mode_tauri(window: tauri::WebviewWindow, minimal: bool) -> Result<(), String> {
    IS_MINIMAL.store(minimal, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    {
        if minimal {
            // Do NOT clear vibrancy, as it can reset the window to opaque gray.
            // Instead, we just disable the shadow and resize.
            let _ = window.set_shadow(false);
            
            // Calculate size dynamically to match full-mode keyboard size
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let m_size = monitor.size();
                let scale_factor = window.scale_factor().unwrap_or(1.0);
                
                // Full mode window is 90% of screen height.
                // Full mode keyboard is window_height - 140px.
                let window_h_phys = m_size.height as f64 * 0.9;
                let offset_phys = 140.0 * scale_factor;
                let target_h_phys = window_h_phys - offset_phys;
                let target_w_phys = target_h_phys * 2.5;

                // Add a small buffer (20px) so the sharp window edges are invisible
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: (target_w_phys + 20.0 * scale_factor) as u32,
                    height: (target_h_phys + 20.0 * scale_factor) as u32,
                }));
            }
            let _ = window.center();
        } else {
            let _ = window_vibrancy::apply_mica(&window, None);
            let _ = window.set_shadow(true);
            
            // Restore to large size
            resize_to_90_percent(&window);
            let _ = window.center();
        }
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
        .invoke_handler(tauri::generate_handler![
            launch_start_program, 
            launch_program_by_path,
            get_running_processes,
            get_system_shortcuts,
            get_local_shortcuts,
            get_shortcut_icon,
            set_minimal_mode_tauri
        ])
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
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window_events.hide();
                    }
                    WindowEvent::Resized(size) => {
                        if IS_MINIMAL.load(Ordering::SeqCst) {
                            let width = size.width as f64;
                            let height = size.height as f64;
                            let target_ratio = 2.5;
                            let current_ratio = width / height;

                            if (current_ratio - target_ratio).abs() > 0.01 {
                                // Fix ratio by adjusting height
                                let new_height = (width / target_ratio) as u32;
                                let _ = window_events.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                                    width: size.width,
                                    height: new_height,
                                }));
                            }
                        }
                    }
                    _ => {}
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
