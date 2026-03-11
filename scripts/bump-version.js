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
    }

    // 4. Створюємо маркер для фронтенду в папці public
    fs.writeFileSync("public/app-version.json", JSON.stringify({ version }, null, 2));

    // 5. Додаємо всі змінені файли до поточного коміту
    execSync(`git add package.json package-lock.json ${tauriPath} ${cargoPath} public/app-version.json`, { stdio: "inherit" });

    console.log(`✅ Версія оновлена до: ${version}`);
} catch (error) {
    console.error("❌ Помилка Bump-версії:", error);
    process.exit(1); // Зупинити коміт при помилці
}
