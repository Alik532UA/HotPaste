/**
 * Клієнтська централізована обробка помилок (ERROR-HANDLING-v10 § 2.4).
 */
import { logService } from "./lib/services/logService.svelte";

export interface ClientErrorPayload {
  error: unknown;
  status?: number;
  message?: string;
}

export function handleError({
  error,
  status = 500,
  message = "Internal Error",
}: ClientErrorPayload) {
  const errorId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  logService.error(
    "client-unhandled",
    `Unhandled client error, status ${status}, id ${errorId}`,
    error,
  );
  return { message, errorId };
}
