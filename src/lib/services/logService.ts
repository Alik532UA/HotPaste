/**
 * Log Service — Central log collection
 * Stores recent logs in RAM to be exportable.
 */

const recentLogs: string[] = [];
const MAX_RECENT_LOGS = 1000;

export const logService = {
    // Основний метод для логування
    log(category: string, message: string, ...args: unknown[]) {
        const logMsg = `[${category.toUpperCase()}] ${message}`;
        this.addToRecent(logMsg, args);
        console.log(logMsg, ...args);
    },

    addToRecent(msg: string, args: unknown[]) {
        const time = new Date().toISOString();
        // Серіалізація аргументів (об'єктів) у рядок
        const fullMsg = `${time} ${msg} ${args.map(a => {
            try {
                if (typeof a === 'object') return JSON.stringify(a);
                return String(a);
            } catch {
                return '[Complex Object]';
            }
        }).join(' ')}`;

        recentLogs.push(fullMsg);

        // Видалення старих логів при перевищенні ліміту
        if (recentLogs.length > MAX_RECENT_LOGS) recentLogs.shift();

        // Додавання у global window для доступу через консоль (опціонально)
        if (typeof window !== 'undefined') {
            (window as any).__recentLogs = recentLogs;
        }
    },

    getRecentLogs() {
        return recentLogs.join('\n');
    }
};
