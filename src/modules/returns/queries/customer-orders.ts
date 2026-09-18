import "server-only";

import { db } from "@/lib/database";
import type { CustomerOrderIdentity } from "../application/request-return";

export async function getCustomerOrder(orderNumber: string, identity: CustomerOrderIdentity) {
  return db.order.findFirst({
    where: {
      orderNumber,
      ...("userId" in identity ? { userId: identity.userId } : { guestAccessTokenHash: identity.guestAccessTokenHash }),
    },
    include: {
      productReviews: true,
      sellerReviews: true,
      payments: {
        orderBy: { createdAt: "desc" },
        include: { transactions: { orderBy: { createdAt: "desc" } } },
      },
      sellerOrders: {
        include: {
          shipment: true,
          cancellationRequests: true,
          disputes: true,
          items: {
            include: {
              productReview: true,
              returnItems: { include: { returnRequest: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
