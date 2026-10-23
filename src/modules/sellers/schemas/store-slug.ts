import type { ZodError } from "zod";

/** Exemplo exibido abaixo do identificador da loja no cadastro e no perfil. */
export const STORE_SLUG_EXAMPLE = "Ex.: luiz-parts: letras minúsculas, números e hífen.";

/**
 * Separa o erro do identificador (exibido no próprio campo) dos demais erros do
 * formulário (exibidos na mensagem geral).
 */
export type StoreSlugFormProblem = { error?: string; slugError?: string; field?: string };

export function splitStoreSlugIssue(error: ZodError, slugKey: string): StoreSlugFormProblem {
  const slugIssue = error.issues.find((issue) => issue.path[0] === slugKey);
  const otherIssue = error.issues.find((issue) => issue.path[0] !== slugKey);
  const otherField = typeof otherIssue?.path[0] === "string" ? otherIssue.path[0] : undefined;
  return {
    ...(otherIssue ? { error: otherIssue.message } : {}),
    // The form points at the field of the general message; the identifier is marked by its own error.
    ...(otherField ? { field: otherField } : {}),
    ...(slugIssue ? { slugError: slugIssue.message } : {}),
  };
}
