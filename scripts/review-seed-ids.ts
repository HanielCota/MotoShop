import { createHash } from "node:crypto";

/**
 * IDs determinísticos dos dados de revisão ampliados.
 *
 * O prefixo `rvw` nunca é gerado por `cuid()` (que sempre começa com "c"), e o restante é derivado
 * de `kind:key`. Assim o seed pode usar `createMany({ skipDuplicates: true })` de forma idempotente,
 * e o script de remoção consegue reconhecer com segurança linhas criadas pelo seed em tabelas que
 * pertencem a usuários reais (endereços, motos salvas e carrinho das contas de visualização),
 * recalculando o ID esperado em vez de confiar em um rótulo.
 */
export const REVIEW_ID_PREFIX = "rvw";

export function reviewId(kind: string, key: string): string {
  return REVIEW_ID_PREFIX + createHash("sha256").update(`${kind}:${key}`).digest("hex").slice(0, 22);
}

/** Endereços criados para contas de visualização terminam com este sufixo no rótulo. */
export const REVIEW_ADDRESS_LABEL_SUFFIX = " (demonstração)";

export const viewerAddressId = (userId: string, index: number) => reviewId("viewer-address", `${userId}:${index}`);
export const viewerSavedMotorcycleId = (userId: string, fitmentId: string) =>
  reviewId("viewer-saved-motorcycle", `${userId}:${fitmentId}`);
export const viewerCartId = (userId: string) => reviewId("viewer-cart", userId);

export function parseEmailList(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
