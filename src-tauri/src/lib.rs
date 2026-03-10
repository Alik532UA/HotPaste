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
use std::time::Duration;
use tokio::time::timeout;
use futures::future::join_all;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static IS_MINIMAL: AtomicBool = AtomicBool::new(false);

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
                    let radius = (4.0 * scale_factor) as i32;
                    let diameter = radius * 1;
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

        // Process missing icons PARALLEL, 1-by-1, with 3s timeout
        let futures = missing_paths.into_iter().map(|path| {
            let cache_dir_clone = cache_dir.clone();
            async move {
                let path_clone = path.clone();
                let result = timeout(Duration::from_secs(3), async {
                    extract_single_icon(path_clone).await
                }).await;

                match result {
                    Ok(Ok(b64)) => {
                        let hash = format!("{:x}", md5::compute(path.as_bytes()));
                        let cache_file = cache_dir_clone.join(format!("{}.png", hash));
                        if let Ok(binary_data) = general_purpose::STANDARD.decode(&b64) {
                            let _ = std::fs::write(&cache_file, binary_data);
                        }
                        Some((path, b64))
                    }
                    Ok(Err(e)) => {
                        println!("[ICONS_ERROR] Failed for {}: {}", path, e);
                        None
                    }
                    Err(_) => {
                        println!("[ICONS_TIMEOUT] 3s timeout reached for {}", path);
                        None
                    }
                }
            }
        });

        let extracted: Vec<(String, String)> = join_all(futures).await.into_iter().flatten().collect();
        results.extend(extracted);

        Ok(results)
    }
    #[cfg(not(target_os = "windows"))]
    { Err("Not supported".to_string()) }
}

async fn extract_single_icon(path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    
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

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAP {{
        public int bmType;
        public int bmWidth;
        public int bmHeight;
        public int bmWidthBytes;
        public ushort bmPlanes;
        public ushort bmBitsPixel;
        public IntPtr bmBits;
    }}

    [DllImport("gdi32.dll")]
    public static extern int GetObject(IntPtr hgdiobj, int cbBuffer, out BITMAP lpvObject);

    public static string GetBase64(string path, int targetSize) {{
        if (string.IsNullOrEmpty(path)) return "";
        string b64 = ExtractAndProcess(path, targetSize);
        if (targetSize > 48 && !string.IsNullOrEmpty(b64)) {{
            try {{
                byte[] data = Convert.FromBase64String(b64);
                using (var ms = new System.IO.MemoryStream(data))
                using (var bmp = new Bitmap(ms)) {{
                    float density = GetSolidDensity(bmp);
                    if (density < 0.20f) {{
                        string fallbackB64 = ExtractAndProcess(path, 48);
                        if (!string.IsNullOrEmpty(fallbackB64)) return fallbackB64;
                    }}
                }}
            }} catch {{ }}
        }}
        return b64;
    }}

    private static string ExtractAndProcess(string path, int size) {{
        IntPtr hBitmap = IntPtr.Zero;
        try {{
            IShellItemImageFactory factory;
            Guid guid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
            int hr = SHCreateItemFromParsingName(path, IntPtr.Zero, guid, out factory);
            if (hr == 0 && factory != null) {{
                SIZE s = new SIZE {{ cx = size, cy = size }};
                hr = factory.GetImage(s, 0x4, out hBitmap);
                if (hr == 0 && hBitmap != IntPtr.Zero) {{
                    BITMAP bm;
                    GetObject(hBitmap, Marshal.SizeOf(typeof(BITMAP)), out bm);
                    Bitmap finalBmp = null;
                    if (bm.bmBitsPixel == 32 && bm.bmBits != IntPtr.Zero) {{
                        using (Bitmap temp = new Bitmap(bm.bmWidth, bm.bmHeight, bm.bmWidthBytes, PixelFormat.Format32bppArgb, bm.bmBits)) {{
                            finalBmp = new Bitmap(temp);
                            finalBmp.RotateFlip(RotateFlipType.RotateNoneFlipY);
                        }}
                    }} else {{
                        finalBmp = Bitmap.FromHbitmap(hBitmap);
                    }}
                    try {{
                        if (finalBmp != null) {{
                            Bitmap croppedBmp = CropTransparent(finalBmp, 25);
                            try {{
                                using (System.IO.MemoryStream ms = new System.IO.MemoryStream()) {{
                                    croppedBmp.Save(ms, ImageFormat.Png);
                                    return Convert.ToBase64String(ms.ToArray());
                                }}
                            }} finally {{
                                if (croppedBmp != finalBmp) croppedBmp.Dispose();
                            }}
                        }}
                    }} finally {{
                        if (finalBmp != null) finalBmp.Dispose();
                        DeleteObject(hBitmap);
                    }}
                }}
            }}
        }} catch {{ }} finally {{ if (hBitmap != IntPtr.Zero) DeleteObject(hBitmap); }}
        if (size <= 48) {{
            try {{
                using (Icon assocIcon = Icon.ExtractAssociatedIcon(path)) {{
                    if (assocIcon != null) {{
                        using (Bitmap bmp = assocIcon.ToBitmap())
                        using (System.IO.MemoryStream ms = new System.IO.MemoryStream()) {{
                            bmp.Save(ms, ImageFormat.Png);
                            return Convert.ToBase64String(ms.ToArray());
                        }}
                    }}
                }}
            }} catch {{ }}
        }}
        return "";
    }}

    private static float GetSolidDensity(Bitmap bmp) {{
        int w = bmp.Width;
        int h = bmp.Height;
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try {{
            int solidPixels = 0;
            int[] pixels = new int[w * h];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            for (int i = 0; i < pixels.Length; i++) {{ if (((pixels[i] >> 24) & 0xFF) > 30) solidPixels++; }}
            return (float)solidPixels / (w * h);
        }} finally {{ bmp.UnlockBits(data); }}
    }}

    private static Bitmap CropTransparent(Bitmap bmp, int threshold) {{
        int w = bmp.Width;
        int h = bmp.Height;
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try {{
            int top = h, bottom = 0, left = w, right = 0;
            int[] pixels = new int[w * h];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            for (int y = 0; y < h; y++) {{
                for (int x = 0; x < w; x++) {{
                    int alpha = (pixels[y * w + x] >> 24) & 0xFF;
                    if (alpha > threshold) {{
                        if (x < left) left = x; if (x > right) right = x;
                        if (y < top) top = y; if (y > bottom) bottom = y;
                    }}
                }}
            }}
            if (right < left || bottom < top) return bmp;
            int cropW = right - left + 1; int cropH = bottom - top + 1;
            if (cropW == w && cropH == h) return bmp;
            return bmp.Clone(new Rectangle(left, top, cropW, cropH), bmp.PixelFormat);
        }} catch {{ return bmp; }} finally {{ bmp.UnlockBits(data); }}
    }}
}}
"@ -ReferencedAssemblies System.Drawing, System.Windows.Forms
    }} catch {{ }}
}}

$p = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{}'))
if (Test-Path -LiteralPath $p) {{
    $b64 = [JumboIcon]::GetBase64($p, 256)
    if ([string]::IsNullOrEmpty($b64) -and $p.EndsWith('.lnk')) {{
        try {{
            $wsh = New-Object -ComObject WScript.Shell
            $link = $wsh.CreateShortcut($p)
            if ($link.TargetPath -and (Test-Path -LiteralPath $link.TargetPath)) {{ 
                $b64 = [JumboIcon]::GetBase64($link.TargetPath, 256)
            }}
        }} catch {{ }}
    }}
    if (![string]::IsNullOrEmpty($b64)) {{ Write-Output "---B64_START---$b64" }}
}}
"##,
        general_purpose::STANDARD.encode(path.as_bytes())
    );

    let utf16_script: Vec<u16> = script.encode_utf16().collect();
    let u8_script: Vec<u8> = utf16_script.iter().flat_map(|&u| u.to_le_bytes().to_vec()).collect();
    let encoded_script = general_purpose::STANDARD.encode(&u8_script);

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &encoded_script])
        .output()
        .map_err(|e| e.to_string())?;

    let result_str = String::from_utf8_lossy(&output.stdout).to_string();
    if let Some(idx) = result_str.find("---B64_START---") {
        return Ok(result_str[idx + "---B64_START---".len()..].trim().to_string());
    }

    Err("Icon not found in output".to_string())
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
        let _ = std::fs::remove_dir_all(&cache_dir);
        let _ = std::fs::create_dir_all(&cache_dir);
    }
    Ok(())
}

#[tauri::command]
async fn get_system_apps() -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-StartApps | ForEach-Object {
                    [PSCustomObject]@{ Name=$_.Name; Path=$_.AppID; Icon=$null }
                } | ConvertTo-Json"
            ])
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(vec![]) }
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
            resize_to_minimal(&window);
            let _ = window.center();
        } else {
            resize_to_90_percent(&window);
            let _ = window.center();
        }
        set_rounded_corners(&window);
    }
    Ok(())
}

#[tauri::command]
async fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
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
            get_system_apps,
            get_shortcut_icon,
            get_shortcut_icons_batch,
            clear_icon_cache,
            set_minimal_mode_tauri,
            hide_window
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
                            // Let the window resize freely
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
        let window_w_phys = m_size.width as f64 * 0.7;

        let phys_w = window_w_phys as u32;
        let phys_h = window_h_phys as u32;

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
