// scripts/bump-version.js
import fs from "fs";
import { execSync } from "child_process";

try {
    console.log("🔄 Авто-інкремент версії (Svelte + Tauri + Cargo)...");

    // 1. Оновлюємо package.json та отримуємо нову версію
    execSync("npm version patch --no-git-tag-version --force", { stdio: "inherit" });
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const version = pkg.version;

    // 2. Оновлюємо src-tauri/tauri.conf.json (Tauri Config)
    const tauriPath = "src-tauri/tauri.conf.json";
    if (fs.existsSync(tauriPath)) {
        const tauri = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
        // Tauri v2 structure might differ slightly, but let's stick to the plan
        if (tauri.version !== undefined) tauri.version = version;
        if (tauri.package) tauri.package.version = version;
        fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2));
    }

    // 3. Оновлюємо src-tauri/Cargo.toml (Rust Version)
    const cargoPath = "src-tauri/Cargo.toml";
    if (fs.existsSync(cargoPath)) {
        let cargo = fs.readFileSync(cargoPath, "utf8");
        cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
        fs.writeFileSync(cargoPath, cargo);
        
        /*
         * СИНХРОНІЗАЦІЯ Cargo.lock — і чому тут тепер ДВА шляхи.
         *
         * Доти був один: `cargo update --workspace`, а невдача ловилася в
         * `catch` і давала попередження «можливо, Rust не встановлено». Рівно
         * це й ставалося на машині, де `cargo` не в системному PATH (а в
         * Windows після `rustup` він саме там і не з'являється в усіх
         * оболонках). Попередження в потоці виводу хука ніхто не читає.
         *
         * Наслідок був не косметичний: `Cargo.toml` їхав на нову версію, а
         * `Cargo.lock` лишався на старій. Збірка з `--locked` — та, що стоїть
         * у `shell.yml` і в будь-якому відтворюваному релізі — після цього
         * ПАДАЄ з «cannot update the lock file because --locked was passed».
         * Тобто кожен коміт, зроблений без cargo в PATH, ламав релізну збірку,
         * і побачити це можна було лише в CI.
         *
         * Запасний шлях не потребує cargo взагалі: версія самого пакета в
         * lock-файлі — це один рядок під `name = "hotpaste"`, і залежностей
         * він не стосується. Переписати його текстом безпечно рівно тому, що
         * дерево залежностей при бампі власної версії не міняється.
         */
        const cargoLockPath = "src-tauri/Cargo.lock";
        let locked = false;
        try {
            console.log("📦 Синхронізація Cargo.lock...");
            execSync("cd src-tauri && cargo update --workspace", { stdio: "inherit" });
            locked = true;
        } catch {
            console.warn("⚠️ cargo недоступний — правлю Cargo.lock текстом.");
        }

        if (!locked && fs.existsSync(cargoLockPath)) {
            const lock = fs.readFileSync(cargoLockPath, "utf8");
            const patched = lock.replace(
                /(name = "hotpaste"\r?\nversion = )"[^"]*"/,
                `$1"${version}"`
            );
            if (patched === lock) {
                // Форма файлу змінилася — мовчати не можна: саме мовчання й
                // зробило попередню поломку невидимою.
                console.error("❌ У Cargo.lock не знайдено версії пакета hotpaste.");
                process.exit(1);
            }
            fs.writeFileSync(cargoLockPath, patched);
            console.log("✅ Cargo.lock синхронізовано без cargo.");
        }
    }

    // 4. Створюємо маркер для фронтенду в папці public
    fs.writeFileSync("public/app-version.json", JSON.stringify({ 
        version,
        buildTime: new Date().toISOString()
    }, null, 2));

    // 5. Додаємо всі змінені файли до поточного коміту
    const cargoLockPath = "src-tauri/Cargo.lock";
    let addFiles = `package.json package-lock.json ${tauriPath} ${cargoPath} public/app-version.json`;
    if (fs.existsSync(cargoLockPath)) addFiles += ` ${cargoLockPath}`;

    execSync(`git add ${addFiles}`, { stdio: "inherit" });

    console.log(`✅ Версія оновлена до: ${version}`);
} catch (error) {
    console.error("❌ Помилка Bump-версії:", error);
    process.exit(1); // Зупинити коміт при помилці
}
