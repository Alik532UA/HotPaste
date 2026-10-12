/**
 * Спеціалізовані доменні класи помилок (ERROR-HANDLING-v10 § 1.2).
 */
import { AppError } from "./AppError";

export class ValidationError extends AppError {
  override name = "ValidationError";
  constructor(public readonly fields: Record<string, string>) {
    super("VALIDATION_ERROR", "Validation failed");
  }
}

export class NotFoundError extends AppError {
  override name = "NotFoundError";
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`);
  }
}

export type NetworkErrorInit = {
  /** HTTP-статус, якщо відповідь була; без нього — збій з'єднання. */
  status?: number;
  /** Пауза з заголовка Retry-After, мс. */
  retryAfterMs?: number;
  cause?: unknown;
};

export class NetworkError extends AppError {
  override name = "NetworkError";
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(
    message: string,
    { status, retryAfterMs, cause }: NetworkErrorInit = {},
  ) {
    super("NETWORK_ERROR", message, { cause });
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export class AuthError extends AppError {
  override name = "AuthError";
  constructor(message = "Authentication required") {
    super("AUTH_ERROR", message);
  }
}

export { AppError };
export * from "./errorToMessageKey";
