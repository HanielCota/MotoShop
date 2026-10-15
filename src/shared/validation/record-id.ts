import { z } from "zod";

import { ApplicationError } from "@/shared/errors/application-error";

const recordIdSchema = z.cuid();

/**
 * Server Action arguments come from the browser even when the signature says `string`
 * (`action.bind(null, id)` can be replayed with anything), so record IDs are checked at the edge.
 */
export function isRecordId(value: unknown): value is string {
  return recordIdSchema.safeParse(value).success;
}

export function assertRecordId(value: unknown, message: string): asserts value is string {
  if (isRecordId(value)) return;

  throw new ApplicationError({ code: "VALIDATION_ERROR", message, statusCode: 400 });
}
