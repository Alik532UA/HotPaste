/**
 * Advanced Log Service — Central log collection with levels and buffering.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    category: string;
    message: string;
    data?: unknown[];
}

const MAX_LOGS = 500;
let logs = $state<LogEntry[]>([]);

/** Log visibility config */
export const logConfig: Record<string, boolean> = {
    app: false,
    appstate: false,
    filesystem: false,
    ui: false,
    hotkeys: false,
    fsstate: false,
    hotkeystate: false,
    startmenu: true,
};

const levelStyles: Record<LogLevel, string> = {
    debug: 'color: #888; font-weight: normal;',
    info: 'color: #00d2ff; font-weight: bold;',
    warn: 'color: #ffcc00; font-weight: bold;',
    error: 'color: #ff4b4b; font-weight: bold;'
};

export const logService = {
    get entries() { return logs; },

    debug(category: string, message: string, ...data: unknown[]) {
        this.add('debug', category, message, data);
    },

    info(category: string, message: string, ...data: unknown[]) {
        this.add('info', category, message, data);
    },

    warn(category: string, message: string, ...data: unknown[]) {
        this.add('warn', category, message, data);
    },

    error(category: string, message: string, ...data: unknown[]) {
        this.add('error', category, message, data);
    },

    /** Generic log method for backward compatibility or custom levels */
    log(levelOrCategory: string, message: string, ...data: unknown[]) {
        const level: LogLevel = ['debug', 'info', 'warn', 'error'].includes(levelOrCategory) 
            ? (levelOrCategory as LogLevel) 
            : 'info';
        
        const category = level === (levelOrCategory as any) ? 'APP' : levelOrCategory;
        this.add(level, category, message, data);
    },

    add(level: LogLevel, category: string, message: string, data: unknown[]) {
        const cat = category.toLowerCase();
        if (cat in logConfig && !logConfig[cat] && level !== 'error') return;

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            category: category.toUpperCase(),
            message,
            data: data.length > 0 ? data : undefined
        };

        // Add to reactive buffer
        logs.push(entry);
        if (logs.length > MAX_LOGS) logs.shift();

        // Console output
        const timeStr = entry.timestamp.toLocaleTimeString();
        console.log(
            `%c[${timeStr}] [${entry.level.toUpperCase()}] [${entry.category}] %c${message}`,
            levelStyles[level],
            'color: inherit; font-weight: normal;',
            ...(data.length > 0 ? data : [])
        );

        // Expose to window for manual export
        if (typeof window !== 'undefined') {
            (window as any).__logs = logs;
        }
    },

    getRecentLogsText(): string {
        return logs.map(e => 
            `[${e.timestamp.toISOString()}] [${e.level.toUpperCase()}] [${e.category}] ${e.message} ${e.data ? JSON.stringify(e.data) : ''}`
        ).join('\n');
    },

    clear() {
        logs = [];
    }
};
