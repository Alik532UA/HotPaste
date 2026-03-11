// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    // Check if we should run as a background hook worker
    if args.iter().any(|arg| arg == "--hook-worker") {
        app_lib::run_hook_worker();
    } else {
        app_lib::run();
    }
}
