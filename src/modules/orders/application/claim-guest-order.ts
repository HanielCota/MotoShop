import "server-only";

import { db } from "@/lib/database";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { ApplicationError } from "@/shared/errors/application-error";

export async function claimGuestOrder(input: {
  orderNumber: string;
  accessToken: string;
  userId: string;
  userEmail: string;
}) {
  const tokenHash = hashGuestToken(input.accessToken);
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, guestAccessTokenHash: tokenHash, userId: null },
    select: { id: true, customerEmail: true },
  });
  if (!order) {
    throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido de convidado não encontrado ou já vinculado." });
  }
  if (order.customerEmail.trim().toLowerCase() !== input.userEmail.trim().toLowerCase()) {
    throw new ApplicationError({
      code: "FORBIDDEN",
      message: "Entre com a conta que utiliza o mesmo e-mail informado na compra.",
    });
  }

  const updated = await db.order.updateMany({
    where: { id: order.id, userId: null, guestAccessTokenHash: tokenHash },
    data: { userId: input.userId, guestAccessTokenHash: null },
  });
  if (updated.count !== 1) {
    throw new ApplicationError({ code: "CONFLICT", message: "Este pedido já foi vinculado. Atualize a página." });
  }
  return { orderNumber: input.orderNumber };
}
