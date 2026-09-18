export type ApplicationErrorCode =
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_MONEY"
  | "INVALID_INVENTORY_QUANTITY"
  | "OUT_OF_STOCK"
  | "INTERNAL_ERROR";

type ApplicationErrorOptions = {
  code: ApplicationErrorCode;
  message: string;
  statusCode?: number;
  cause?: unknown;
};

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly statusCode: number;

  constructor({ code, message, statusCode = 500, cause }: ApplicationErrorOptions) {
    super(message, { cause });
    this.name = "ApplicationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function asApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error;
  }

  return new ApplicationError({
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
    cause: error,
  });
}
