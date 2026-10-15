import { logger } from "@/lib/logger";

import { asApplicationError, type ApplicationError } from "./application-error";

function describeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: typeof error, message: "Non-Error value thrown" };
}

/** Logs an unexpected failure of a Server Action; the user only sees a generic message. */
export function logActionFailure(action: string, error: unknown): void {
  logger.error({ event: "action.failed", action, error: describeError(error) });
}

/**
 * Converts what a Server Action caught into an `ApplicationError`. Expected domain and validation
 * errors pass through silently; anything that becomes the generic INTERNAL_ERROR is logged first.
 */
export function toActionError(error: unknown, action: string): ApplicationError {
  const applicationError = asApplicationError(error);
  if (applicationError.code === "INTERNAL_ERROR") logActionFailure(action, error);
  return applicationError;
}
