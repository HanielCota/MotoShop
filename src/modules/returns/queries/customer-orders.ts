import "server-only";

import { db } from "@/lib/database";
import {
  customerOrderIdentityWhere,
  type CustomerOrderIdentity,
} from "@/modules/orders/application/resolve-customer-order-access";

export async function getCustomerOrder(orderNumber: string, identity: CustomerOrderIdentity) {
  return db.order.findFirst({
    where: {
      orderNumber,
      ...customerOrderIdentityWhere(identity),
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
