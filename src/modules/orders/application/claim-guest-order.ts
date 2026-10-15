import "server-only";

import { db } from "@/lib/database";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { ApplicationError } from "@/shared/errors/application-error";

import { isGuestOrderAccessExpired } from "../domain/guest-order-access";
import { guestOrderAccessSelect, toGuestOrderAccessDates } from "./resolve-customer-order-access";

export async function claimGuestOrder(input: {
  orderNumber: string;
  accessToken: string;
  userId: string;
  userEmail: string;
  userEmailVerified: boolean;
}) {
  // An unverified account could have been registered by anyone holding the guest link;
  // claiming revokes the link, so only a verified owner of the e-mail may do it.
  if (!input.userEmailVerified) {
    throw new ApplicationError({
      code: "FORBIDDEN",
      message: "Confirme o e-mail da sua conta antes de vincular este pedido.",
    });
  }

  const tokenHash = hashGuestToken(input.accessToken);
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, guestAccessTokenHash: tokenHash, userId: null },
    select: { id: true, customerEmail: true, ...guestOrderAccessSelect },
  });
  if (!order || isGuestOrderAccessExpired(toGuestOrderAccessDates(order), new Date())) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido de convidado não encontrado ou já vinculado." });
  }
  if (order.customerEmail.trim().toLowerCase() !== input.userEmail.trim().toLowerCase()) {
    throw new ApplicationError({
      code: "FORBIDDEN",
      message: "Entre com a conta que utiliza o mesmo e-mail informado na compra.",
    });
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, userId: null, guestAccessTokenHash: tokenHash },
      data: { userId: input.userId, guestAccessTokenHash: null },
    });
    if (updated.count !== 1) {
      throw new ApplicationError({ code: "CONFLICT", message: "Este pedido já foi vinculado. Atualize a página." });
    }
    await tx.auditLog.create({
      data: {
        action: "ORDER_GUEST_CLAIMED",
        entityType: "Order",
        entityId: order.id,
        actorUserId: input.userId,
        metadata: { orderNumber: input.orderNumber },
      },
    });
  });
  return { orderNumber: input.orderNumber };
}
