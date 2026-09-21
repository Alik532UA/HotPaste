//! ПЕРЕЛІКИ ЯРЛИКІВ: процеси, меню «Пуск», застосунки зі Store, свої ярлики.

use crate::state::CREATE_NO_WINDOW;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub(crate) struct ShortcutInfo {
    name: String,
    path: String,
    icon: Option<String>,
}

#[tauri::command]
pub(crate) async fn get_running_processes() -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "$ErrorActionPreference = 'SilentlyContinue'; $WarningPreference = 'SilentlyContinue'; Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object {
                    try {
                        $p = $_.Path;
                        if (!$p) { $p = $_.MainModule.FileName }
                        if ($p) { [PSCustomObject]@{ Name=$_.Name; Path=$p; Icon=$null } }
                    } catch { }
                 } | ConvertTo-Json"
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub(crate) async fn get_system_shortcuts() -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "$ErrorActionPreference = 'SilentlyContinue'; $WarningPreference = 'SilentlyContinue'; Get-ChildItem -Path @(\"$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs\", \"$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\") -Filter *.lnk -Recurse | ForEach-Object {
                    [PSCustomObject]@{ Name=$_.BaseName; Path=$_.FullName; Icon=$null }
                } | ConvertTo-Json"
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub(crate) async fn get_local_shortcuts(app: AppHandle) -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use base64::{engine::general_purpose, Engine as _};
        let docs = app.path().document_dir().map_err(|e| e.to_string())?;
        let start_path = docs.join("HotPaste").join("start");

        if !start_path.exists() {
            let _ = std::fs::create_dir_all(&start_path);
            return Ok(vec![]);
        }

        let start_path_b64 =
            general_purpose::STANDARD.encode(start_path.to_string_lossy().as_bytes());

        let script = format!(
            r##"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
             $root = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('{}'));
             Get-ChildItem -Path $root -Recurse | Where-Object {{ $_.Extension -match 'lnk|exe' }} | ForEach-Object {{
                [PSCustomObject]@{{ Name=$_.BaseName; Path=$_.FullName; Icon=$null }}
             }} | ConvertTo-Json"##,
            start_path_b64
        );

        let utf16_script: Vec<u16> = script.encode_utf16().collect();
        let u8_script: Vec<u8> = utf16_script
            .iter()
            .flat_map(|&u| u.to_le_bytes().to_vec())
            .collect();
        let encoded_script = general_purpose::STANDARD.encode(&u8_script);

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-EncodedCommand",
                &encoded_script,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub(crate) async fn get_system_apps() -> Result<Vec<ShortcutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "$ErrorActionPreference = 'SilentlyContinue'; Get-StartApps | ForEach-Object { [PSCustomObject]@{ Name=$_.Name; Path=$_.AppID; Icon=$null } } | ConvertTo-Json",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        parse_shortcuts_json(output.stdout)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![])
    }
}

pub(crate) fn parse_shortcuts_json(stdout: Vec<u8>) -> Result<Vec<ShortcutInfo>, String> {
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
