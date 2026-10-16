import "server-only";

import { db } from "@/lib/database";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";

import { isGuestOrderAccessExpired } from "../domain/guest-order-access";
import { guestOrderAccessSelect, toGuestOrderAccessDates } from "./guest-order-access-dates";
import { isGuestOrderLinkToken } from "../infrastructure/guest-order-link-token";

export type CustomerOrderIdentity = { userId: string } | { guestAccessTokenHash: string };

export type CustomerOrderAccessInput = {
  orderNumber: string;
  /** Token do link seguro enviado no checkout de convidado. */
  accessToken?: string | null | undefined;
  /** Usuário da sessão atual, quando houver. */
  userId?: string | null | undefined;
  now?: Date | undefined;
};

export function customerOrderIdentityWhere(identity: CustomerOrderIdentity) {
  return "userId" in identity ? { userId: identity.userId } : { guestAccessTokenHash: identity.guestAccessTokenHash };
}

/**
 * Resolve qual credencial dá acesso ao pedido, com a mesma regra da página do pedido: o token de
 * convidado primeiro (um usuário logado pode abrir um pedido de convidado pelo link recebido), depois
 * o usuário logado. O token de convidado pode ser o do checkout ou o do link do e-mail
 * (guest-order-link-token.ts); os dois expiram (guest-order-access.ts) e deixam de valer no vínculo
 * à conta. Retorna `null` quando nenhuma credencial informada é dona do pedido.
 */
export async function resolveCustomerOrderIdentity(
  input: CustomerOrderAccessInput,
): Promise<CustomerOrderIdentity | null> {
  const now = input.now ?? new Date();
  if (input.accessToken) {
    const guestIdentity =
      (await findByCheckoutToken(input.orderNumber, input.accessToken, now)) ??
      (await findByEmailLinkToken(input.orderNumber, input.accessToken, now));
    if (guestIdentity) return guestIdentity;
  }
  if (!input.userId) return null;

  const owned = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, userId: input.userId },
    select: { id: true },
  });
  return owned ? { userId: input.userId } : null;
}

async function findByCheckoutToken(orderNumber: string, token: string, now: Date) {
  const guestAccessTokenHash = hashGuestToken(token);
  const order = await db.order.findFirst({
    where: { orderNumber, guestAccessTokenHash },
    select: guestOrderAccessSelect,
  });
  if (!order || isGuestOrderAccessExpired(toGuestOrderAccessDates(order), now)) return null;
  return { guestAccessTokenHash };
}

async function findByEmailLinkToken(orderNumber: string, token: string, now: Date) {
  const order = await db.order.findFirst({
    where: { orderNumber, userId: null, guestAccessTokenHash: { not: null } },
    select: { id: true, guestAccessTokenHash: true, ...guestOrderAccessSelect },
  });
  if (!order?.guestAccessTokenHash || !isGuestOrderLinkToken(order.id, token)) return null;
  if (isGuestOrderAccessExpired(toGuestOrderAccessDates(order), now)) return null;
  // Same identity as the checkout token: every query below keeps scoping by the order's guest hash.
  return { guestAccessTokenHash: order.guestAccessTokenHash };
}
