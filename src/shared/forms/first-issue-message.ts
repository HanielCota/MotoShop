import type { ZodType } from "zod";

/** Primeira mensagem de erro do schema, ou `null` quando a entrada é válida. */
export function firstIssueMessage(schema: ZodType, input: unknown, fallback: string): string | null {
  const parsed = schema.safeParse(input);
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? fallback;
}
