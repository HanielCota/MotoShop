import type { ZodType } from "zod";

import type { FieldProblem } from "./field-error-focus";

/**
 * Primeiro erro do schema, com o campo do formulário a que ele se refere, ou `null` quando a
 * entrada é válida. `formFields` traduz as chaves do schema que têm outro `name` no formulário.
 */
export function firstIssue(
  schema: ZodType,
  input: unknown,
  fallback: string,
  formFields: Partial<Record<string, string>> = {},
): FieldProblem | null {
  const parsed = schema.safeParse(input);
  if (parsed.success) return null;

  const issue = parsed.error.issues[0];
  const key = typeof issue?.path[0] === "string" ? issue.path[0] : undefined;
  return { message: issue?.message ?? fallback, field: key ? (formFields[key] ?? key) : undefined };
}
