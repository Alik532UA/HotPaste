/**
 * Маппінг помилки на ключ словника без витоку деталей (ERROR-HANDLING-v10 § 4.1).
 */
import {
  AuthError,
  NetworkError,
  NotFoundError,
  ValidationError,
} from "./index";

export type ErrorMessageKey =
  | "errors.validation"
  | "errors.notFound"
  | "errors.network"
  | "errors.auth"
  | "errors.unexpected";

/**
 * Перетворює помилку на словниковий ключ повідомлення.
 * Запобігає витоку сирого err.message, stack trace чи SQL в інтерфейс.
 */
export function errorToMessageKey(err: unknown): ErrorMessageKey {
  if (err instanceof ValidationError) return "errors.validation";
  if (err instanceof NotFoundError) return "errors.notFound";
  if (err instanceof NetworkError) return "errors.network";
  if (err instanceof AuthError) return "errors.auth";
  return "errors.unexpected";
}
