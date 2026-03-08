/**
 * Log Service — Central log collection
 * Stores recent logs in RAM to be exportable.
 */

const recentLogs: string[] = [];
const MAX_RECENT_LOGS = 1000;

/**
 * Керування логами.
 * Щоб вимкнути групу, встановіть false.
 */
export const logConfig = {
    appState: true,
    fileSystem: false,
    ui: false,
    error: true,
};

export const logService = {
    // Основний метод для логування
    log(category: string, message: string, ...args: unknown[]) {
        const cat = category.toLowerCase();
        // Перевірка конфігу (якщо категорія невідома — дозволяємо)
        if (cat in logConfig && !(logConfig as any)[cat]) return;

        const logMsg = `[${category.toUpperCase()}] ${message}`;
        this.addToRecent(logMsg, args);
        console.log(logMsg, ...args);
    },

    addToRecent(msg: string, args: unknown[]) {
        const time = new Date().toISOString();
        // Серіалізація аргументів (об'єктів) у рядок
        const fullMsg = `${time} ${msg} ${args.map(a => {
            try {
                if (typeof a === 'object') {
                    // Unique check for large objects to avoid context bloat in console
                    return JSON.stringify(a).slice(0, 500); 
                }
                return String(a);
            } catch {
                return '[Complex Object]';
            }
        }).join(' ')}`;

        recentLogs.push(fullMsg);

        if (recentLogs.length > MAX_RECENT_LOGS) recentLogs.shift();

        if (typeof window !== 'undefined') {
            (window as any).__recentLogs = recentLogs;
        }
    },

    getRecentLogs() {
        return recentLogs.join('\n');
    }
};
