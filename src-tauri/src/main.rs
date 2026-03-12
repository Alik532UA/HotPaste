// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    // Check if we should run as a background hook worker
    if let Some(hook_idx) = args.iter().position(|arg| arg == "--hook-worker") {
        let vk_code = args.get(hook_idx + 1)
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0x5B); // Default: VK_LWIN (91)

        let use_alt = args.iter().any(|arg| arg == "--use-alt");
        
        app_lib::run_hook_worker(vk_code, use_alt);
    } else {
        app_lib::run();
    }
}
