import "server-only";

import { db } from "@/lib/database";

import { cartOwnerWhere, getCartIdentity } from "../infrastructure/cart-access";

export async function getActiveCart() {
  const identity = await getCartIdentity();
  if (!identity) return null;

  return db.cart.findFirst({
    where: { ...cartOwnerWhere(identity), status: "ACTIVE" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          variant: {
            include: {
              inventory: true,
              product: {
                include: {
                  seller: { include: { store: true } },
                  store: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
