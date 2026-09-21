//! ВІКНО: форма, кути й режими.
//!
//! Тут усе, що стосується самого вікна, — заокруглення через DWM, мінімальний
//! режим, показ і сховування. Win32 зібраний в одному місці навмисно: це
//! єдина частина застосунку, яка не переживе переїзду на іншу систему, і межа
//! має бути видимою.

use crate::state::IS_MINIMAL;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;

/// Force rounded corners and HIDE system border/shadow via DWM API (Windows 11+).
#[cfg(target_os = "windows")]
pub(crate) fn set_rounded_corners(window: &tauri::WebviewWindow) {
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
                DwmSetWindowAttribute(
                    hwnd,
                    33,
                    &corner_preference as *const _ as *const std::ffi::c_void,
                    4,
                );
                DwmSetWindowAttribute(
                    hwnd,
                    34,
                    &border_color as *const _ as *const std::ffi::c_void,
                    4,
                );
                DwmSetWindowAttribute(
                    hwnd,
                    35,
                    &caption_color as *const _ as *const std::ffi::c_void,
                    4,
                );
                DwmSetWindowAttribute(
                    hwnd,
                    20,
                    &dark_mode as *const _ as *const std::ffi::c_void,
                    4,
                );
                DwmSetWindowAttribute(
                    hwnd,
                    2,
                    &nc_policy as *const _ as *const std::ffi::c_void,
                    4,
                );

                if let Ok(size) = window.outer_size() {
                    let scale_factor = window.scale_factor().unwrap_or(1.0);
                    let radius = (4.0 * scale_factor) as i32;
                    let diameter = radius;
                    let rgn = CreateRoundRectRgn(
                        0,
                        0,
                        size.width as i32,
                        size.height as i32,
                        diameter,
                        diameter,
                    );
                    SetWindowRgn(hwnd as _, rgn as _, 1);
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
extern "system" {
    fn SetWindowRgn(hwnd: *mut std::ffi::c_void, hrgn: *mut std::ffi::c_void, bRedraw: i32) -> i32;
    fn CreateRoundRectRgn(
        nLeftRect: i32,
        nTopRect: i32,
        nRightRect: i32,
        nBottomRect: i32,
        nWidthEllipse: i32,
        nHeightEllipse: i32,
    ) -> *mut std::ffi::c_void;
}

#[tauri::command]
pub(crate) async fn set_minimal_mode_tauri(
    window: tauri::WebviewWindow,
    minimal: bool,
) -> Result<(), String> {
    IS_MINIMAL.store(minimal, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    {
        let _ = window.set_shadow(false);
        set_rounded_corners(&window);
        if minimal {
            resize_to_minimal(&window);
        } else {
            resize_to_90_percent(&window);
        }
        let _ = window.center();
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
pub(crate) fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}

pub(crate) fn toggle_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
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

pub(crate) fn resize_to_minimal(window: &tauri::WebviewWindow) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let m_size = monitor.size();
        let phys_w = (m_size.width as f64 * 0.85) as u32;
        let phys_h = (m_size.height as f64 * 0.45) as u32 + 105;
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: phys_w,
            height: phys_h,
        }));
    }
}

pub(crate) fn resize_to_90_percent(window: &tauri::WebviewWindow) {
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
