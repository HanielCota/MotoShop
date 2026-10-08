import { ZodError } from "zod";

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

export const GENERIC_ERROR_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";
export const GENERIC_VALIDATION_MESSAGE = "Confira os dados informados.";

// Zod's built-in (English) messages start with these words; schema-specific
// messages in this project are written in Portuguese and are safe to show.
const zodDefaultMessagePattern = /^(invalid|too (small|big)|unrecognized|expected|required)\b/i;

function validationMessageFrom(error: ZodError): string {
  const message = error.issues[0]?.message?.trim();
  if (!message || zodDefaultMessagePattern.test(message)) return GENERIC_VALIDATION_MESSAGE;
  return message;
}

export function asApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ApplicationError({
      code: "VALIDATION_ERROR",
      message: validationMessageFrom(error),
      statusCode: 400,
      cause: error,
    });
  }

  return new ApplicationError({
    code: "INTERNAL_ERROR",
    message: GENERIC_ERROR_MESSAGE,
    cause: error,
  });
}
