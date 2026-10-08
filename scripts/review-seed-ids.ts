import { createHash } from "node:crypto";

/**
 * IDs determinísticos dos dados de revisão ampliados.
 *
 * Os IDs precisam passar na validação `z.cuid()` das Server Actions (começar com "c"); senão a demo
 * quebra ao favoritar, responder ou moderar itens do seed. O prefixo `czrvw` cumpre isso e continua
 * distinguível de IDs reais: o segundo caractere de um cuid é o início do timestamp em base 36 (hoje
 * "m"), e "z" só apareceria décadas à frente. O restante é derivado de `kind:key`, então o seed pode
 * usar `createMany({ skipDuplicates: true })` de forma idempotente e o script de remoção reconhece
 * com segurança linhas criadas pelo seed em tabelas de usuários reais (endereços, motos salvas e
 * carrinho das contas de visualização), recalculando o ID esperado em vez de confiar em um rótulo.
 */
export const REVIEW_ID_PREFIX = "czrvw";

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
