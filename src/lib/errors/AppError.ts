/**
 * Базовий клас доменних помилок застосунку (ERROR-HANDLING-v10 § 1.1).
 */
export class AppError extends Error {
  // Ім'я — літералом у кожному класі: після мініфікації
  // `this.constructor.name` спотворюється, і журнал губить тип помилки.
  override name = "AppError";

  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
