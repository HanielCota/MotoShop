import "server-only";

import { db } from "@/lib/database";

/**
 * Pedido completo para a mediação do Admin (UX-04): mesmos dados do detail do cliente,
 * mais endereço, contato e as solicitações de pós-venda de cada loja.
 * Só leitura; o acesso é protegido por `requireAdminAccess` na página.
 */
export async function getAdminOrderDetail(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: {
      shippingAddress: true,
      productReviews: true,
      sellerReviews: true,
      payments: {
        orderBy: { createdAt: "desc" },
        include: { transactions: { orderBy: { createdAt: "desc" } } },
      },
      sellerOrders: {
        include: {
          shipment: true,
          cancellationRequests: { orderBy: { createdAt: "desc" } },
          disputes: { orderBy: { createdAt: "desc" } },
          returnRequests: {
            orderBy: { createdAt: "desc" },
            include: {
              items: { include: { orderItem: { select: { productNameSnapshot: true, skuSnapshot: true } } } },
            },
          },
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

export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrderDetail>>>;
export type AdminOrderSellerOrder = AdminOrderDetail["sellerOrders"][number];
