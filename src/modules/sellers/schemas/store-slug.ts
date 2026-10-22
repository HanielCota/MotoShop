import type { ZodError } from "zod";

/** Exemplo exibido abaixo do identificador da loja no cadastro e no perfil. */
export const STORE_SLUG_EXAMPLE = "Ex.: luiz-parts: letras minúsculas, números e hífen.";

/**
 * Separa o erro do identificador (exibido no próprio campo) dos demais erros do
 * formulário (exibidos na mensagem geral).
 */
export type StoreSlugFormProblem = { error?: string; slugError?: string };

export function splitStoreSlugIssue(error: ZodError, slugKey: string): StoreSlugFormProblem {
  const slugIssue = error.issues.find((issue) => issue.path[0] === slugKey);
  const otherIssue = error.issues.find((issue) => issue.path[0] !== slugKey);
  return {
    ...(otherIssue ? { error: otherIssue.message } : {}),
    ...(slugIssue ? { slugError: slugIssue.message } : {}),
  };
}
