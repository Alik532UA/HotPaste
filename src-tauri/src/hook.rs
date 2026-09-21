//! ПЕРЕХОПЛЕННЯ ГАРЯЧОЇ КЛАВІШИ — окремим ПРОЦЕСОМ, а не потоком.
//!
//! Низькорівневий гак клавіатури (`WH_KEYBOARD_LL`) Windows знімає мовчки,
//! якщо обробник не встиг відповісти за відведений час. У процесі, який ще й
//! малює вікно, це трапляється від будь-якого затину — і гаряча клавіша
//! перестає працювати без жодного повідомлення. Тому гак живе у власному
//! процесі (`--hook-worker`), а спілкується він через `stdout` одним словом
//! `TOGGLE`.

use crate::state::{APP_HANDLE, CREATE_NO_WINDOW, HOOK_CHILD};
// Перезапуск гака показує вікно тим самим шляхом, що й трей і клавіша.
use crate::window::toggle_window;
use std::io::{BufRead, BufReader, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;
use windows_sys::Win32::Foundation::LPARAM;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;

#[cfg(target_os = "windows")]
pub(crate) fn kill_hook_worker() {
    if let Ok(mut lock) = HOOK_CHILD.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
}

pub(crate) static WIN_PRESSED: AtomicBool = AtomicBool::new(false);

pub(crate) static OTHER_KEY_PRESSED: AtomicBool = AtomicBool::new(false);

pub(crate) static TARGET_VK: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0x5B);

pub(crate) static TARGET_USE_ALT: AtomicBool = AtomicBool::new(false);

pub fn run_hook_worker(vk_code: u32, use_alt: bool) {
    TARGET_VK.store(vk_code, Ordering::SeqCst);
    TARGET_USE_ALT.store(use_alt, Ordering::SeqCst);

    unsafe {
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc_worker),
            std::ptr::null_mut(),
            0,
        );
        let mut msg = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) != 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook);
    }
}

/*
 * `collapsible_match` вимкнено на всю функцію: clippy пропонує перетворити
 * зовнішній `if` на СТОРОЖ гілки match (`WM_KEYUP | WM_SYSKEYUP if …`).
 * Це змішало б дві різні речі — «яка це подія» й «чи вона наша», — і
 * зробило б непомітним те, що всередині ще й МІНЯЄТЬСЯ стан (`swap`).
 * Обробник гака читають тоді, коли гаряча клавіша перестала працювати;
 * розкладка «подія → умова → дія» тут коштує дорожче за стислість.
 */
#[allow(clippy::collapsible_match)]
pub(crate) unsafe extern "system" fn low_level_keyboard_proc_worker(
    n_code: i32,
    w_param: usize,
    l_param: LPARAM,
) -> isize {
    if n_code == HC_ACTION as i32 {
        let kb_data = *(l_param as *const KBDLLHOOKSTRUCT);
        let vk_code = kb_data.vkCode;

        if (kb_data.flags & 0x10) != 0 {
            return CallNextHookEx(std::ptr::null_mut(), n_code, w_param, l_param);
        }

        let target_vk = TARGET_VK.load(Ordering::SeqCst);
        let use_alt = TARGET_USE_ALT.load(Ordering::SeqCst);

        let is_target = vk_code == target_vk;
        let is_win = vk_code == VK_LWIN as u32 || vk_code == VK_RWIN as u32;

        match w_param as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                if use_alt {
                    let is_alt = (kb_data.flags & LLKHF_ALTDOWN) != 0;
                    if is_target && is_alt {
                        println!("TOGGLE");
                        let _ = std::io::stdout().flush();
                        return 1;
                    }
                } else if is_win && target_vk == VK_LWIN as u32 {
                    WIN_PRESSED.store(true, Ordering::SeqCst);
                    OTHER_KEY_PRESSED.store(false, Ordering::SeqCst);
                } else if is_target {
                    println!("TOGGLE");
                    let _ = std::io::stdout().flush();
                    return 1;
                } else if WIN_PRESSED.load(Ordering::SeqCst) {
                    OTHER_KEY_PRESSED.store(true, Ordering::SeqCst);
                }
            }
            WM_KEYUP | WM_SYSKEYUP => {
                /*
                 * Два УМОВИ, а не одна, і згортати їх не варто попри пораду
                 * clippy. Зовнішня відповідає на «чи це взагалі наш випадок»
                 * (клавіша Win, режим без Alt), внутрішня — на «чи це було
                 * коротке натискання без інших клавіш». Злите в одне, це стає
                 * рядком із п'яти умов, у якому не видно, що перша половина
                 * лише відсіює чужі події, а друга ще й МІНЯЄ стан
                 * (`swap` вище виконується тільки після першої перевірки).
                 */
                if !use_alt && is_win && target_vk == VK_LWIN as u32 {
                    let was_pressed = WIN_PRESSED.swap(false, Ordering::SeqCst);
                    let other_pressed = OTHER_KEY_PRESSED.load(Ordering::SeqCst);

                    if was_pressed && !other_pressed {
                        keybd_event(0xFF, 0, 0, 0);
                        keybd_event(0xFF, 0, KEYEVENTF_KEYUP, 0);
                        println!("TOGGLE");
                        let _ = std::io::stdout().flush();
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
pub(crate) async fn restart_hook_worker_tauri(
    _app: AppHandle,
    vk_code: u32,
    use_alt: bool,
) -> Result<(), String> {
    kill_hook_worker();
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(current_exe);
    cmd.arg("--hook-worker")
        .arg(vk_code.to_string())
        .stdout(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW);
    if use_alt {
        cmd.arg("--use-alt");
    }
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().expect("failed");
    if let Ok(mut lock) = HOOK_CHILD.lock() {
        *lock = Some(child);
    }
    std::thread::spawn(move || {
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
}
