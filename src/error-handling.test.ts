// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AppError,
  ValidationError,
  NotFoundError,
  NetworkError,
  AuthError,
  errorToMessageKey,
} from "./lib/errors";
import { handleError } from "./hooks.client";

const ROOT = process.cwd();

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|svelte)$/.test(entry)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
};

const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (m, p1) => p1 + m.slice(p1.length).replace(/./g, " "),
    );

const sources = walk("src").filter((f) => !/\.(test|spec)\.ts$/.test(f));

describe("Обробка помилок (ERROR-HANDLING-v10)", () => {
  it("доменні класи наслідують AppError з унікальними іменами та кодами", () => {
    const base = new AppError("BASE_CODE", "Base message");
    expect(base).toBeInstanceOf(Error);
    expect(base.name).toBe("AppError");
    expect(base.code).toBe("BASE_CODE");

    const val = new ValidationError({ title: "required" });
    expect(val).toBeInstanceOf(AppError);
    expect(val.name).toBe("ValidationError");
    expect(val.code).toBe("VALIDATION_ERROR");
    expect(val.fields).toEqual({ title: "required" });
    expect(errorToMessageKey(val)).toBe("errors.validation");

    const nf = new NotFoundError("Card");
    expect(nf).toBeInstanceOf(AppError);
    expect(nf.name).toBe("NotFoundError");
    expect(nf.code).toBe("NOT_FOUND");
    expect(errorToMessageKey(nf)).toBe("errors.notFound");

    const net = new NetworkError("Gateway timeout", {
      status: 504,
      retryAfterMs: 2000,
    });
    expect(net).toBeInstanceOf(AppError);
    expect(net.name).toBe("NetworkError");
    expect(net.code).toBe("NETWORK_ERROR");
    expect(net.status).toBe(504);
    expect(net.retryAfterMs).toBe(2000);
    expect(errorToMessageKey(net)).toBe("errors.network");

    const auth = new AuthError();
    expect(auth).toBeInstanceOf(AppError);
    expect(auth.name).toBe("AuthError");
    expect(auth.code).toBe("AUTH_ERROR");
    expect(errorToMessageKey(auth)).toBe("errors.auth");

    expect(errorToMessageKey(new Error("raw error"))).toBe("errors.unexpected");
    expect(errorToMessageKey(null)).toBe("errors.unexpected");
    expect(errorToMessageKey("string failure")).toBe("errors.unexpected");
  });

  it("handleError у hooks.client повертає безпечний результат з errorId", () => {
    const res = handleError({
      error: new Error("secret crash details"),
      status: 500,
    });
    expect(res).toBeDefined();
    expect(res.errorId).toBeDefined();
    expect(typeof res.errorId).toBe("string");
    expect(res.message).toBe("Internal Error");
  });

  it("немає throw рядків у джерелах", () => {
    const bad: string[] = [];
    for (const f of sources) {
      const text = withoutComments(readFileSync(f, "utf8"));
      if (/throw\s+['"`]/.test(text)) {
        bad.push(f);
      }
    }
    expect(bad).toEqual([]);
  });

  it("GlobalErrorFallback та App.svelte не виводять сирий error.message в розмітку", () => {
    const fallbackPath = join(
      ROOT,
      "src/lib/components/ui/GlobalErrorFallback.svelte",
    );
    expect(existsSync(fallbackPath)).toBe(true);
    const content = readFileSync(fallbackPath, "utf8");
    expect(content).not.toMatch(/\{(error as any)\.message\}/);
    expect(content).not.toMatch(/\{error\.message\}/);
  });

  it("App.svelte містить глобальні слухачі unhandledrejection та error", () => {
    const appPath = join(ROOT, "src/App.svelte");
    const content = readFileSync(appPath, "utf8");
    expect(content).toContain("unhandledrejection");
    expect(content).toMatch(/'error'|"error"/);
  });
});
