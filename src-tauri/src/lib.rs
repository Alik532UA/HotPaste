use tauri::{AppHandle, Manager, WindowEvent};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use std::sync::atomic::{AtomicBool, Ordering};
use windows_sys::Win32::UI::WindowsAndMessaging::*;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::Foundation::LPARAM;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;

use std::sync::OnceLock;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static IS_MINIMAL: AtomicBool = AtomicBool::new(true);

/// Force rounded corners and HIDE system border/shadow via DWM API (Windows 11+).
#[cfg(target_os = "windows")]
fn set_rounded_corners(window: &tauri::WebviewWindow) {
    use raw_window_handle::HasWindowHandle;
    if let Ok(handle) = window.window_handle() {
        if let raw_window_handle::RawWindowHandle::Win32(win32_handle) = handle.as_raw() {
            let hwnd = win32_handle.hwnd.get() as windows_sys::Win32::Foundation::HWND;
            
            let corner_preference: u32 = 2; // DWMWCP_ROUND (Standard rounding)
            let border_color: u32 = 0x00010101; // Near Black
            let caption_color: u32 = 0x00010101; // Near Black
            let dark_mode: u32 = 1; // Immersive Dark Mode
            let nc_policy: u32 = 2; // DWMNCRP_ENABLED

            unsafe {
                DwmSetWindowAttribute(hwnd, 33, &corner_preference as *const _ as *const std::ffi::c_void, 4);
                DwmSetWindowAttribute(hwnd, 34, &border_color as *const _ as *const std::ffi::c_void, 4);
                DwmSetWindowAttribute(hwnd, 35, &caption_color as *const _ as *const std::ffi::c_void, 4);
                DwmSetWindowAttribute(hwnd, 20, &dark_mode as *const _ as *const std::ffi::c_void, 4);
                DwmSetWindowAttribute(hwnd, 2, &nc_policy as *const _ as *const std::ffi::c_void, 4);

                if let Ok(size) = window.outer_size() {
                    let scale_factor = window.scale_factor().unwrap_or(1.0);
                    let radius = (48.0 * scale_factor) as i32;
                    let diameter = radius * 2;
                    let rgn = CreateRoundRectRgn(0, 0, size.width as i32, size.height as i32, diameter, diameter);
                    SetWindowRgn(hwnd as _, rgn as _, 1);
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
extern "system" {
    fn SetWindowRgn(hwnd: *mut std::ffi::c_void, hrgn: *mut std::ffi::c_void, bRedraw: i32) -> i32;
    fn CreateRoundRectRgn(nLeftRect: i32, nTopRect: i32, nRightRect: i32, nBottomRect: i32, nWidthEllipse: i32, nHeightEllipse: i32) -> *mut std::ffi::c_void;
}

pub fn run_hook_worker() {
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
                    OTHER_KEY_PRESSED.store(true, Ordering::SeqCst);
                }
            }
            WM_KEYUP | WM_SYSKEYUP => {
                if is_win {
                    let was_pressed = WIN_PRESSED.swap(false, Ordering::SeqCst);
                    let other_pressed = OTHER_KEY_PRESSED.load(Ordering::SeqCst);

                    if was_pressed && !other_pressed {
                        keybd_event(0xFF, 0, 0, 0);
                        keybd_event(0xFF, 0, KEYEVENTF_KEYUP, 0);
                        println!("TOGGLE");
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
        let _ = Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
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
        use base64::{Engine as _, engine::general_purpose};
        let docs = app.path().document_dir().map_err(|e| e.to_string())?;
        let start_path = docs.join("HotPaste").join("start");
        
        if !start_path.exists() {
            std::fs::create_dir_all(&start_path).map_err(|e| e.to_string())?;
            return Ok(vec![]);
        }

        let start_path_b64 = general_purpose::STANDARD.encode(start_path.to_string_lossy().as_bytes());

        let script = format!(
            r##"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
             $root = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{}'));
             Get-ChildItem -Path $root -Recurse | Where-Object {{ $_.Extension -match 'lnk|exe' }} | ForEach-Object {{
                [PSCustomObject]@{{ Name=$_.BaseName; Path=$_.FullName; Icon=$null }}
             }} | ConvertTo-Json"##,
            start_path_b64
        );

        let utf16_script: Vec<u16> = script.encode_utf16().collect();
        let u8_script: Vec<u8> = utf16_script.iter().flat_map(|&u| u.to_le_bytes().to_vec()).collect();
        let encoded_script = general_purpose::STANDARD.encode(&u8_script);

        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded_script])
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(vec![]) }
}

#[tauri::command]
async fn get_shortcut_icons_batch(app: AppHandle, paths: Vec<String>) -> Result<Vec<(String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        use base64::{Engine as _, engine::general_purpose};
        use md5;

        let docs = app.path().document_dir().map_err(|e| e.to_string())?;
        let cache_dir = docs.join("HotPaste").join("start").join("icon-cache");
        if !cache_dir.exists() {
            let _ = std::fs::create_dir_all(&cache_dir);
        }
        
        let mut results = Vec::new();
        let mut missing_paths = Vec::new();

        for path in &paths {
            let hash = format!("{:x}", md5::compute(path.as_bytes()));
            let cache_file = cache_dir.join(format!("{}.png", hash));
            
            if cache_file.exists() {
                if let Ok(data) = std::fs::read(&cache_file) {
                    results.push((path.clone(), general_purpose::STANDARD.encode(data)));
                    continue;
                }
            }
            missing_paths.push(path.clone());
        }

        if missing_paths.is_empty() {
            return Ok(results);
        }

        for chunk in missing_paths.chunks(20) {
            let paths_json = serde_json::to_string(chunk).map_err(|e| e.to_string())?;
            let utf16_json: Vec<u16> = paths_json.encode_utf16().collect();
            let u8_json: Vec<u8> = utf16_json.iter().flat_map(|&u| u.to_le_bytes().to_vec()).collect();
            let paths_b64 = general_purpose::STANDARD.encode(&u8_json);

            let script = format!(
                r##"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
[void][Reflection.Assembly]::LoadWithPartialName('System.Drawing');

if (-not ([System.Management.Automation.PSTypeName]'JumboIcon').Type) {{
    try {{
        Add-Type -TypeDefinition @"
#pragma warning disable
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Collections.Generic;

public class JumboIcon {{
    [StructLayout(LayoutKind.Sequential)]
    public struct SIZE {{
        public int cx;
        public int cy;
    }}

    [ComImport]
    [Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IShellItemImageFactory {{
        [PreserveSig]
        int GetImage([In, MarshalAs(UnmanagedType.Struct)] SIZE size, [In] int flags, [Out] out IntPtr phbm);
    }}

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    public static extern int SHCreateItemFromParsingName(
        [In, MarshalAs(UnmanagedType.LPWStr)] string pszPath,
        [In] IntPtr pbc,
        [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid,
        [Out, MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    public static string GetBase64(string path, int targetSize) {{
        if (string.IsNullOrEmpty(path)) return "";
        IntPtr hBitmap = IntPtr.Zero;
        try {{
            // Modern Shell API for high-quality images (Vista+)
            IShellItemImageFactory factory;
            Guid guid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
            int hr = SHCreateItemFromParsingName(path, IntPtr.Zero, guid, out factory);
            
            if (hr == 0 && factory != null) {{
                SIZE size = new SIZE {{ cx = targetSize, cy = targetSize }};
                // SIIGBF_RESIZETOFIT = 0, SIIGBF_BIGGERSIZEOK = 1, SIIGBF_ICONONLY = 4
                hr = factory.GetImage(size, 0x1 | 0x4, out hBitmap);
                if (hr == 0 && hBitmap != IntPtr.Zero) {{
                    using (Bitmap bmp = Bitmap.FromHbitmap(hBitmap)) {{
                        DeleteObject(hBitmap);
                        Console.WriteLine("DIAG: Factory returned " + bmp.Width + "x" + bmp.Height + " for " + path);
                        using (System.IO.MemoryStream ms = new System.IO.MemoryStream()) {{
                            bmp.Save(ms, ImageFormat.Png);
                            return Convert.ToBase64String(ms.ToArray());
                        }}
                    }}
                }}
            }}
        }} catch (Exception ex) {{
            Console.WriteLine("DIAG: Factory failed for " + path + ": " + ex.Message);
        }} finally {{
            if (hBitmap != IntPtr.Zero) DeleteObject(hBitmap);
        }}

        // LAST RESORT Fallback
        try {{
            using (Icon assocIcon = Icon.ExtractAssociatedIcon(path)) {{
                if (assocIcon != null) {{
                    using (Bitmap bmp = assocIcon.ToBitmap()) {{
                        Console.WriteLine("DIAG: Final fallback 32x32 for " + path);
                        using (System.IO.MemoryStream ms = new System.IO.MemoryStream()) {{
                            bmp.Save(ms, ImageFormat.Png);
                            return Convert.ToBase64String(ms.ToArray());
                        }}
                    }}
                }}
            }}
        }} catch {{ }}
        
        return "";
    }}
}}
"@ -ReferencedAssemblies System.Drawing, System.Windows.Forms
    }} catch {{
        Write-Host "DIAG: Add-Type failed: $($_.Exception.Message)"
    }}
}}

$jsonRaw = [System.Convert]::FromBase64String('{}')
$json = [System.Text.Encoding]::Unicode.GetString($jsonRaw)
$paths = $json | ConvertFrom-Json
$out = @{{}}
$wsh = New-Object -ComObject WScript.Shell

# Crucial: Unroll array if PS 5.1 returned it as a single object
foreach ($p in @($paths)) {{
    try {{
        if (-not (Test-Path $p)) {{
            Write-Host "DIAG: Path not found: $p"
            continue
        }}
        $t = $p
        if ($p.EndsWith('.lnk')) {{
            try {{
                $link = $wsh.CreateShortcut($p)
                if ($link.TargetPath -and (Test-Path $link.TargetPath)) {{ 
                    $t = $link.TargetPath 
                }}
            }} catch {{ }}
        }}
        $base64 = [JumboIcon]::GetBase64($t, 256)
        if ([string]::IsNullOrEmpty($base64) -and $t -ne $p) {{ 
            $base64 = [JumboIcon]::GetBase64($p, 256) 
        }}
        if (![string]::IsNullOrEmpty($base64)) {{ 
            $out[$p] = $base64 
            Write-Host "DIAG: Success for $p"
        }} else {{
            Write-Host "DIAG: Failed extraction for $p"
        }}
    }} catch {{ 
        Write-Host "DIAG: Error for $p : $($_.Exception.Message)"
    }}
}}

Write-Output "---JSON_START---"
if ($out.Count -eq 0) {{
    Write-Output "{{}}"
}} else {{
    $out | ConvertTo-Json -Compress
}}
"##,
                paths_b64
            );

            let utf16_script: Vec<u16> = script.encode_utf16().collect();
            let u8_script: Vec<u8> = utf16_script.iter().flat_map(|&u| u.to_le_bytes().to_vec()).collect();
            let encoded_script = general_purpose::STANDARD.encode(&u8_script);

            let output = Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded_script])
                .output()
                .map_err(|e| e.to_string())?;

            let result_str = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr_str = String::from_utf8_lossy(&output.stderr).to_string();
            
            for line in result_str.lines() {
                if line.starts_with("DIAG:") {
                    println!("[ICONS_DIAG] {}", line);
                }
            }

            if !stderr_str.is_empty() {
                println!("[ICONS_BATCH_STDERR] {}", stderr_str);
            }

            println!("[ICONS_BATCH] stdout length: {}, exit: {:?}", result_str.len(), output.status.code());
            
            if let Some(json_index) = result_str.find("---JSON_START---") {
                let json_str = &result_str[json_index + "---JSON_START---".len()..].trim();
                
                if !json_str.is_empty() {
                    match serde_json::from_str::<std::collections::HashMap<String, String>>(json_str) {
                        Ok(map) => {
                            println!("[ICONS_BATCH] Parsed {} icon entries", map.len());
                            for (p, b64) in map {
                                if let Ok(binary_data) = general_purpose::STANDARD.decode(&b64) {
                                    let hash = format!("{:x}", md5::compute(p.as_bytes()));
                                    let cache_file = cache_dir.join(format!("{}.png", hash));
                                    let _ = std::fs::write(&cache_file, binary_data);
                                }
                                results.push((p, b64));
                            }
                        }
                        Err(e) => {
                            println!("[ICONS_BATCH] JSON parse error: {}", e);
                            println!("[ICONS_BATCH] Raw json_str: {:?}", json_str);
                        }
                    }
                }
            }
        }

        Ok(results)
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Not supported".to_string()) }
}

#[tauri::command]
async fn get_shortcut_icon(app: AppHandle, path: String) -> Result<String, String> {
    let results = get_shortcut_icons_batch(app, vec![path.clone()]).await?;
    for (p, b64) in results {
        if p == path {
            return Ok(b64);
        }
    }
    Err("Failed to get icon".to_string())
}

#[tauri::command]
async fn clear_icon_cache(app: AppHandle) -> Result<(), String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let cache_dir = docs.join("HotPaste").join("start").join("icon-cache");
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        let _ = std::fs::create_dir_all(&cache_dir);
    }
    Ok(())
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
            let icon = item["Icon"].as_str().map(|s| s.to_string());
            shortcuts.push(ShortcutInfo {
                name: name.to_string(),
                path: path.to_string(),
                icon,
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
        let _ = window.set_shadow(false);
        set_rounded_corners(&window);
        
        if minimal {
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let m_size = monitor.size();
                let scale_factor = window.scale_factor().unwrap_or(1.0);
                
                let window_h_phys = m_size.height as f64 * 0.7;
                let offset_phys = 140.0 * scale_factor;
                let target_h_phys = window_h_phys - offset_phys;
                let target_w_phys = target_h_phys * 2.5;

                let phys_w = target_w_phys as u32;
                let phys_h = target_h_phys as u32;

                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: phys_w,
                    height: phys_h,
                }));
            }
            let _ = window.center();
        } else {
            resize_to_90_percent(&window);
            let _ = window.center();
        }
        set_rounded_corners(&window);
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
            get_shortcut_icons_batch,
            clear_icon_cache,
            set_minimal_mode_tauri
        ])
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                if IS_MINIMAL.load(Ordering::SeqCst) {
                    resize_to_minimal(&window);
                } else {
                    resize_to_90_percent(&window);
                }
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.center();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle);

            let show_item = MenuItemBuilder::with_id("show", "Show HotPaste").build(app).expect("failed to build menu item");
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app).expect("failed to build menu item");
            let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build().expect("failed to build menu");
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
                .build(app).expect("failed to build tray icon");

            let window = app.get_webview_window("main").unwrap();
            
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
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window_events.hide();
                    }
                    WindowEvent::Resized(_) => {
                        #[cfg(target_os = "windows")]
                        set_rounded_corners(&window_events);

                        if IS_MINIMAL.load(Ordering::SeqCst) {
                            if let Ok(size) = window_events.outer_size() {
                                let width = size.width as f64;
                                let height = size.height as f64;
                                let target_ratio = 2.5;
                                let current_ratio = width / height;

                                if (current_ratio - target_ratio).abs() > 0.01 {
                                    let new_height = (width / target_ratio) as u32;
                                    let _ = window_events.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                                        width: size.width,
                                        height: new_height,
                                    }));
                                }
                            }
                        }
                    }
                    _ => {}
                }
            });

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
            if IS_MINIMAL.load(Ordering::SeqCst) {
                resize_to_minimal(&window);
            } else {
                resize_to_90_percent(&window);
            }
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.center();
        }
    }
}

fn resize_to_minimal(window: &tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let m_size = monitor.size();
        let scale_factor = window.scale_factor().unwrap_or(1.0);
        
        let window_h_phys = m_size.height as f64 * 0.7;
        let offset_phys = 140.0 * scale_factor;
        let target_h_phys = window_h_phys - offset_phys;
        let target_w_phys = target_h_phys * 2.5;

        let phys_w = target_w_phys as u32;
        let phys_h = target_h_phys as u32;

        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: phys_w,
            height: phys_h,
        }));
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
