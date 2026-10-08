import "server-only";

import { db } from "@/lib/database";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";

export type CustomerOrderIdentity = { userId: string } | { guestAccessTokenHash: string };

export type CustomerOrderAccessInput = {
  orderNumber: string;
  /** Token do link seguro enviado no checkout de convidado. */
  accessToken?: string | null | undefined;
  /** Usuário da sessão atual, quando houver. */
  userId?: string | null | undefined;
};

export function customerOrderIdentityWhere(identity: CustomerOrderIdentity) {
  return "userId" in identity ? { userId: identity.userId } : { guestAccessTokenHash: identity.guestAccessTokenHash };
}

/**
 * Credenciais candidatas na ordem de precedência: o token do link seguro vem primeiro,
 * porque um usuário logado pode abrir um pedido de convidado pelo link recebido por e-mail.
 */
export function getCustomerOrderIdentityCandidates(
  input: Omit<CustomerOrderAccessInput, "orderNumber">,
): CustomerOrderIdentity[] {
  const candidates: CustomerOrderIdentity[] = [];
  if (input.accessToken) candidates.push({ guestAccessTokenHash: hashGuestToken(input.accessToken) });
  if (input.userId) candidates.push({ userId: input.userId });
  return candidates;
}

/**
 * Resolve qual credencial dá acesso ao pedido, com a mesma regra da página do pedido:
 * token do link seguro primeiro, depois o usuário logado. Retorna `null` quando nenhuma
 * credencial informada é dona do pedido.
 */
export async function resolveCustomerOrderIdentity(
  input: CustomerOrderAccessInput,
): Promise<CustomerOrderIdentity | null> {
  for (const identity of getCustomerOrderIdentityCandidates(input)) {
    const order = await db.order.findFirst({
      where: { orderNumber: input.orderNumber, ...customerOrderIdentityWhere(identity) },
      select: { id: true },
    });
    if (order) return identity;
  }
  return null;
}
