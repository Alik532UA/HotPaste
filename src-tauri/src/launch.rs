//! ЗАПУСК ЯРЛИКІВ — найгостріше місце застосунку.
//!
//! Усе в цьому модулі викликається З ВЕБВʼЮ через `invoke`, тобто рядок сюди
//! приходить іззовні. Саме тут колись стояв `cmd /C <рядок>`, і будь-який XSS
//! у застосунку, який показує вміст чужих файлів, означав виконання довільної
//! команди.
//!
//! Тепер межі три, і кожна пояснена на місці: перелік дозволених схем URI
//! (а не заборонений список), `ShellExecute` з ОКРЕМИМИ файлом і аргументами
//! замість оболонки, і `canonicalize` там, де шлях мусить лишитися всередині
//! теки проєкту.

use tauri::{AppHandle, Manager};
use windows_sys::Win32::UI::WindowsAndMessaging::*;

/// Схеми, за якими дозволено відкривати посилання.
///
/// ПЕРЕЛІК, А НЕ ЗАБОРОНЕНИЙ СПИСОК. `ShellExecute` на `foo:bar` віддає рядок
/// зареєстрованому обробникові схеми `foo:`, а обробники в системі бувають
/// різні — саме так працював Follina (`ms-msdt:`). Заборонений список тут
/// застаріває від кожного оновлення Windows, перелік — ні.
///
/// Розширювати цей масив можна й треба: якщо ярлик перестав запускатися, у
/// журналі буде рядок із назвою схеми й посиланням сюди. Це свідоме рішення, а
/// не мовчазна відмова.
#[cfg(target_os = "windows")]
pub(crate) const ALLOWED_URI_SCHEMES: &[&str] = &[
    "http",
    "https",
    "mailto",
    "tel",
    "ms-settings",
    "ms-windows-store",
];

/// Запустити ярлик: шлях до файлу, AUMID застосунку зі Store або посилання.
///
/// ЩО ЗВІДСИ ПРИБРАНО Й ЧОМУ. Раніше передостаннім кроком стояло ось це:
///
/// ```ignore
/// if path.contains(' ') {
///     Command::new("cmd").args(["/C", &path]).spawn();
/// }
/// ```
///
/// Запустити ярлик: шлях до файлу, AUMID застосунку зі Store або посилання.
///
/// ЩО ЗВІДСИ ПРИБРАНО Й ЧОМУ. Раніше передостаннім кроком стояло ось це:
///
/// ```ignore
/// if path.contains(' ') {
///     Command::new("cmd").args(["/C", &path]).spawn();
/// }
/// ```
///
/// Тобто будь-який рядок із пробілом, який не виявився наявним файлом,
/// виконувався оболонкою. Оболонка розбирає `&`, `|`, `>`, `%VAR%` і лапки, тож
/// це не «запуск програми з аргументами», а виконання довільної команди — і
/// дотягнутися до нього можна було з вебвʼю через `invoke`. У застосунку без
/// CSP, який показує вміст чужих файлів, це означає: будь-який XSS стає
/// виконанням команди.
///
/// Запуск з аргументами лишився — але через `ShellExecute`, який приймає файл і
/// параметри ОКРЕМИМИ значеннями й нічого в них не розбирає. Форма: шлях у
/// лапках, далі аргументи (`"C:\Tools\app.exe" --flag`). Те, що не розкладається
/// у «наявний файл + аргументи», не запускається взагалі й повертає помилку з
/// поясненням, а не тишу.
#[tauri::command]
pub(crate) async fn launch_program_by_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::Path;

        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Err("порожній шлях".into());
        }

        // 1. AUMID застосунку зі Store. Перевіряється ПЕРШИМ: інакше Windows
        // тлумачить префікс `www.` у такому рядку як адресу.
        if trimmed.contains('!') {
            let app_path = if trimmed.starts_with("shell:") {
                trimmed.to_string()
            } else {
                format!("shell:AppsFolder\\{}", trimmed)
            };
            return launch_via_shell_execute(&app_path, None);
        }

        // 2. Наявний файл або тека — найчастіший випадок, і найдешевший для
        // перевірки: існування питаємо у файлової системи, а не за виглядом
        // рядка.
        if Path::new(trimmed).exists() {
            return launch_via_shell_execute(trimmed, None);
        }

        // 3. Шлях у лапках плюс аргументи.
        if let Some((file, args)) = split_quoted_command(trimmed) {
            if !Path::new(&file).exists() {
                return Err(format!(
                    "у лапках указано «{}», але такого файлу немає",
                    file
                ));
            }
            return launch_via_shell_execute(&file, args.as_deref());
        }

        // 4. Посилання зі схеми з переліку.
        if let Some(scheme) = uri_scheme(trimmed) {
            if ALLOWED_URI_SCHEMES.contains(&scheme.as_str()) {
                return launch_via_shell_execute(trimmed, None);
            }
            return Err(format!(
                "схема «{}:» не в переліку дозволених. Якщо вона потрібна — \
                 додайте її до ALLOWED_URI_SCHEMES у src-tauri/src/lib.rs",
                scheme
            ));
        }

        // 5. Коротке імʼя без роздільників: `notepad`, `calc`, `control`.
        // Такі розв'язує сам `ShellExecute` через App Paths і PATH.
        if !trimmed.contains(' ') && !trimmed.contains('\\') && !trimmed.contains('/') {
            if launch_via_shell_execute(trimmed, None).is_ok() {
                return Ok(());
            }
            // Останній здогад — той самий рядок як AUMID.
            return launch_via_shell_execute(&format!("shell:AppsFolder\\{}", trimmed), None);
        }

        // 6. Решта — відмова З ПОЯСНЕННЯМ.
        //
        // Доти саме сюди потрапляли команди з аргументами, і виконувала їх
        // оболонка. Тиша була б гіршою за відмову: людина не дізналася б, що
        // ярлик перестав працювати й чому.
        Err(format!(
            "«{}» не є ні наявним файлом, ні посиланням із дозволеної схеми. \
             Щоб запустити програму з аргументами, візьміть шлях до неї в лапки: \
             \"C:\\Tools\\app.exe\" --flag",
            trimmed
        ))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Ok(())
    }
}

/// Схема посилання (`ms-settings:display` → `ms-settings`), якщо рядок на неї
/// схожий.
///
/// Літера диска — НЕ схема: `C:\Users` дає `c`, і без цієї умови кожен
/// абсолютний шлях Windows читався б як посилання.
#[cfg(target_os = "windows")]
pub(crate) fn uri_scheme(value: &str) -> Option<String> {
    let colon = value.find(':')?;
    let scheme = &value[..colon];

    if scheme.len() < 2 {
        return None;
    }
    if !scheme
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '-' || c == '.')
    {
        return None;
    }
    Some(scheme.to_ascii_lowercase())
}

/// Розкласти `"C:\Tools\app.exe" --flag` на файл і рядок аргументів.
///
/// Лапки обовʼязкові саме тому, що без них розкладання неоднозначне: шляхи
/// Windows самі містять пробіли, і вгадувати, де закінчується імʼя файлу,
/// означало б інколи запускати не те.
#[cfg(target_os = "windows")]
pub(crate) fn split_quoted_command(value: &str) -> Option<(String, Option<String>)> {
    let rest = value.strip_prefix('"')?;
    let end = rest.find('"')?;
    let file = rest[..end].to_string();
    let args = rest[end + 1..].trim();

    if file.is_empty() {
        return None;
    }
    Some((
        file,
        if args.is_empty() {
            None
        } else {
            Some(args.to_string())
        },
    ))
}

/// Запустити ярлик із теки `Документи/HotPaste/start`.
///
/// ЦІЄЇ КОМАНДИ НЕ ІСНУВАЛО, хоч фронтенд кликав її для кожного місцевого
/// ярлика (`StartMenuState.launchKey`, гілка `type === 'local'`). Невідома
/// команда відповідає помилкою, помилка потрапляла в `catch` і лягала в
/// журнал — тобто ціла категорія ярликів не запускалася ніколи, і виглядало це
/// як «нічого не сталося».
///
/// Окрема команда, а не виклик `launch_program_by_path`: місцевий ярлик за
/// визначенням лежить у СВОЇЙ теці, і перевірити це дешевше, ніж довіряти
/// рядку з вебвʼю. `canonicalize` тут обовʼязковий — без нього
/// `start\..\..\..\Windows\System32\cmd.exe` пройшов би перевірку префікса.
#[tauri::command]
pub(crate) async fn launch_start_program(app: AppHandle, name: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let root = app
            .path()
            .document_dir()
            .map_err(|e| e.to_string())?
            .join("HotPaste")
            .join("start");

        let root = std::fs::canonicalize(&root)
            .map_err(|_| "теки Документи/HotPaste/start немає".to_string())?;
        let target =
            std::fs::canonicalize(&name).map_err(|_| format!("ярлика «{}» немає", name))?;

        if !target.starts_with(&root) {
            return Err(format!(
                "«{}» лежить поза текою Документи/HotPaste/start",
                name
            ));
        }

        launch_via_shell_execute(&target.to_string_lossy(), None)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, name);
        Ok(())
    }
}

/// `ShellExecuteW` з ОКРЕМИМ рядком параметрів.
///
/// Саме окремим, і це головне в цій функції. Оболонка (`cmd /C`) розбирає в
/// переданому рядку `&`, `|`, `>`, `%VAR%` і лапки — тобто один рядок може
/// означати кілька команд. `ShellExecuteW` нічого з цим не робить: `file` іде
/// до системи як імʼя файлу, `params` — до запущеної програми як її
/// командний рядок. Тому «запустити з аргументами» тут можливо, а «виконати
/// довільну команду» — ні.
#[cfg(target_os = "windows")]
pub(crate) fn launch_via_shell_execute(file: &str, params: Option<&str>) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;

    let to_wide = |value: &str| -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(Some(0))
            .collect()
    };

    let wide_file = to_wide(file);
    let wide_open = to_wide("open");
    let wide_params = params.map(to_wide);

    unsafe {
        let h_instance = ShellExecuteW(
            std::ptr::null_mut(),
            wide_open.as_ptr(),
            wide_file.as_ptr(),
            wide_params
                .as_ref()
                .map_or(std::ptr::null(), |p| p.as_ptr()),
            std::ptr::null(),
            SW_SHOWNORMAL,
        );

        if h_instance as isize <= 32 {
            return Err(format!(
                "ShellExecuteW failed (error code: {})",
                h_instance as isize
            ));
        }
    }
    Ok(())
}

/// МЕЖА «РЯДОК ІЗ ВЕБВʼЮ → ЗАПУСК ПРОГРАМИ» — під прогоном, а не під оком.
///
/// Тут перевіряються рівно ті дві чисті функції, від яких залежить, чи
/// перетвориться XSS у застосунку на виконання довільного коду. Решта
/// модуля кличе Windows і в тесті не відтворюється — але вирішують саме
/// вони: `launch_program_by_path` довіряє їхньому вердикту.
///
/// Доти на Rust у цьому проєкті не було ЖОДНОГО тесту. Значення це має саме
/// тут: помилка в розборі рядка не падає й не світиться в журналі — вона
/// просто пропускає те, що мала відкинути.
#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::{split_quoted_command, uri_scheme, ALLOWED_URI_SCHEMES};

    #[test]
    fn літера_диска_не_є_схемою() {
        /*
         * НАЙВАЖЛИВІШИЙ ВИПАДОК ФАЙЛУ. `C:\Users\…` формально виглядає як
         * посилання зі схемою `c`. Якби воно ним читалося, кожен абсолютний
         * шлях Windows потрапляв би в гілку перевірки схем — і або відкидався
         * (застосунок не запускає нічого), або, що гірше, проходив повз
         * перевірку існування файлу.
         */
        assert_eq!(uri_scheme(r"C:\Users\alik5"), None);
        assert_eq!(uri_scheme(r"D:/games/app.exe"), None);
    }

    #[test]
    fn схема_розпізнається_і_зводиться_до_нижнього_регістру() {
        // Порівняння з переліком іде за точним рядком, тож `MS-Settings:` без
        // зведення регістру не збіглося б ні з чим і мовчки відкидалося.
        assert_eq!(uri_scheme("https://example.com").as_deref(), Some("https"));
        assert_eq!(
            uri_scheme("MS-Settings:display").as_deref(),
            Some("ms-settings")
        );
        assert_eq!(uri_scheme("mailto:a@b.c").as_deref(), Some("mailto"));
    }

    #[test]
    fn сміття_схемою_не_вважається() {
        assert_eq!(uri_scheme("без двокрапки"), None);
        assert_eq!(uri_scheme("ha ck:er"), None, "пробіл у схемі");
        assert_eq!(uri_scheme("a:b"), None, "схема з однієї літери");
    }

    #[test]
    fn перелік_схем_не_містить_небезпечних() {
        /*
         * ПЕРЕЛІК, А НЕ ЗАБОРОНЕНИЙ СПИСОК — і ця перевірка стереже саме те,
         * що перелік лишається переліком. `ms-msdt:` це Follina; `file:` і
         * `javascript:` віддають оболонці те, що вебвʼю не має права віддавати
         * взагалі. Жодного з них тут немає й не мусить з'явитися непомітно.
         */
        for forbidden in [
            "ms-msdt",
            "file",
            "javascript",
            "vbscript",
            "search-ms",
            "shell",
        ] {
            assert!(
                !ALLOWED_URI_SCHEMES.contains(&forbidden),
                "{forbidden}: у переліку дозволених схем з'явилася небезпечна"
            );
        }
        // Перевірка жива: перелік не порожній і містить те, заради чого існує.
        assert!(ALLOWED_URI_SCHEMES.contains(&"https"));
    }

    #[test]
    fn шлях_у_лапках_розкладається_на_файл_і_аргументи() {
        assert_eq!(
            split_quoted_command(r#""C:\Tools\app.exe" --flag"#),
            Some((r"C:\Tools\app.exe".to_string(), Some("--flag".to_string())))
        );
        assert_eq!(
            split_quoted_command(r#""C:\Tools\app.exe""#),
            Some((r"C:\Tools\app.exe".to_string(), None))
        );
    }

    #[test]
    fn без_лапок_не_розкладається_взагалі() {
        /*
         * Лапки обовʼязкові саме тому, що без них розкладання неоднозначне:
         * шляхи Windows самі містять пробіли. Вгадувати межу означало б
         * інколи запускати НЕ ТЕ — тобто найгірший можливий вид помилки в
         * цьому місці.
         */
        assert_eq!(
            split_quoted_command(r"C:\Program Files\app.exe --flag"),
            None
        );
        assert_eq!(split_quoted_command(r#""незакрита лапка --flag"#), None);
        assert_eq!(
            split_quoted_command(r#""" --flag"#),
            None,
            "порожнє імʼя файлу"
        );
    }

    #[test]
    fn аргументи_лишаються_одним_рядком_і_не_розбираються() {
        /*
         * Тут немає й не мусить бути жодного розбору `&`, `|`, `%VAR%`: рядок
         * аргументів іде в `ShellExecute` ОКРЕМИМ значенням, тобто оболонки на
         * шляху немає. Перевірка фіксує саме це — функція повертає те, що їй
         * дали, а не намагається щось у ньому зрозуміти.
         */
        assert_eq!(
            split_quoted_command(r#""C:\app.exe" a & b | c %PATH%"#),
            Some((
                r"C:\app.exe".to_string(),
                Some("a & b | c %PATH%".to_string())
            ))
        );
    }
}
