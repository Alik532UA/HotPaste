//! ШЛЯХИ Й ПРОВІДНИК.
//!
//! `explorer <рядок>` радо ЗАПУСКАЄ передане, якщо це програма, тож віддавати
//! цю дію вебвʼю без обмеження шляху не можна. Назовні йде лише
//! `reveal_in_project`, і межу перевіряє файлова система через `canonicalize`,
//! а не регулярка.

use tauri::{AppHandle, Manager};

/// Показати файл або теку у провіднику. Внутрішня, без перевірок.
///
/// Не команда: `explorer <рядок>` радо ЗАПУСКАЄ передане, якщо це програма,
/// тож віддавати цю дію вебвʼю без обмеження шляху не можна. Назовні йде
/// `reveal_in_project`, і межу перевіряє саме вона.
#[cfg(target_os = "windows")]
pub(crate) fn open_path(path: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let _ = Command::new("explorer")
        .arg(path)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Показати у провіднику щось УСЕРЕДИНІ теки проєкту.
///
/// Доти те саме робив фронтенд, і двома способами одразу:
/// `Command.create('explorer', [fullPath])` через плагін оболонки, а як
/// запасний — `open('file:///…')`. Обидва вимагали дозволів, ширших за
/// потребу: `shell:allow-execute` з аргументом `.+` — це «запустити explorer
/// із будь-чим», тобто запустити будь-яку програму; схема `file:` в
/// `shell:allow-open` — те саме коротшим шляхом.
///
/// Потреба ж вузька: показати теку вкладки, а вона завжди лежить у
/// `Документи/HotPaste`. Тому межа тут, а не в регулярці ACL, і перевіряє її
/// файлова система: `canonicalize` розкриває `..`, без якого
/// `HotPaste\..\..\Windows\System32` пройшов би перевірку префікса.
#[tauri::command]
pub(crate) async fn reveal_in_project(app: AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let root = app
            .path()
            .document_dir()
            .map_err(|e| e.to_string())?
            .join("HotPaste");

        let root = std::fs::canonicalize(&root)
            .map_err(|_| "теки Документи/HotPaste немає".to_string())?;
        let target = std::fs::canonicalize(&path).map_err(|_| format!("немає «{}»", path))?;

        if !target.starts_with(&root) {
            return Err(format!("«{}» лежить поза текою Документи/HotPaste", path));
        }

        open_path(&target.to_string_lossy())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, path);
        Ok(())
    }
}

#[tauri::command]
pub(crate) async fn open_local_shortcuts_folder(app: AppHandle) -> Result<(), String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    let start_path = docs.join("HotPaste").join("start");
    if !start_path.exists() {
        std::fs::create_dir_all(&start_path).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        // Шлях тут складений НАМИ з `document_dir()`, а не прийшов із вебвʼю,
        // тож перевіряти його немає чого.
        open_path(&start_path.to_string_lossy())
    }
    #[cfg(not(target_os = "windows"))]
    Ok(())
}
