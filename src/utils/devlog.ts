/**
 * @file devlog.ts
 * @author Raúl García Balongo
 * @date 2025
 */

type Level = "INFO" | "WARN" | "ERROR";

const INFO_STYLE  = "background:#D1FAE5;color:#065F46;border-radius:4px;padding:0 4px;font-weight:600;";
const WARN_STYLE  = "background:#FEF3C7;color:#92400E;border-radius:4px;padding:0 4px;font-weight:700;";
const ERROR_STYLE = "background:#FEE2E2;color:#991B1B;border-radius:4px;padding:0 4px;font-weight:700;";

const CTX_STYLE   = "background:#E5E7EB;color:#374151;border-radius:4px;padding:0 4px;";
const TIME_STYLE  = "color:#9CA3AF;font-family:monospace;";
const RESET       = "";

const LEVEL_META: Record<Level, { label: string; icon: string; style: string }> = {
    INFO:  { label: "INFO",  icon: "ℹ️", style: INFO_STYLE  },
    WARN:  { label: "WARN",  icon: "⚠️", style: WARN_STYLE  },
    ERROR: { label: "ERROR", icon: "⛔", style: ERROR_STYLE },
};

function ts(): string {
    const d = new Date();
    const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(),3)}`;
}

function out(level: Level, ctx: string, args: unknown[]) {
    const { label, icon, style } = LEVEL_META[level];
    const prefix = `%c${icon} ${label}%c %c${ctx}%c %c${ts()}%c`;
    const styles = [style, RESET, CTX_STYLE, RESET, TIME_STYLE, RESET];
    // 👇 Siempre usamos console.info (aunque sea warn/error)
    console.info(prefix, ...styles, ...args);
}

export const devlog = {
    info:  (ctx: string, ...args: unknown[]) => out("INFO",  ctx, args),
    warn:  (ctx: string, ...args: unknown[]) => out("WARN",  ctx, args),
    error: (ctx: string, ...args: unknown[]) => out("ERROR", ctx, args),
};
