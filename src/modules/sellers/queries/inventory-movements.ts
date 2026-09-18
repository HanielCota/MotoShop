import "server-only";

import { db } from "@/lib/database";

import { InventoryMovementType } from "@/generated/prisma/enums";
import type { InventorySort } from "../inventory-search-params";

export async function listSellerInventoryMovements(
  sellerId: string,
  input: {
    q?: string | null;
    type?: string;
    from?: string | null;
    to?: string | null;
    sort?: InventorySort;
    limit?: number;
  } = {},
) {
  const query = input.q?.trim().slice(0, 100);
  const type = input.type && input.type !== "ALL" ? (input.type as InventoryMovementType) : undefined;
  const from = parseInventoryDate(input.from, false);
  const to = parseInventoryDate(input.to, true);
  return db.inventoryMovement.findMany({
    where: {
      sellerId,
      ...(type ? { type } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
      ...(query
        ? {
            variant: {
              OR: [
                { sku: { contains: query, mode: "insensitive" as const } },
                { title: { contains: query, mode: "insensitive" as const } },
                { product: { name: { contains: query, mode: "insensitive" as const } } },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
      type: true,
      quantityChange: true,
      availableQuantityAfter: true,
      reservedQuantityAfter: true,
      reason: true,
      createdAt: true,
      variant: { select: { title: true, sku: true, product: { select: { id: true, name: true } } } },
      actor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: input.sort === "oldest" ? "asc" : "desc" },
    take: Math.min(Math.max(input.limit ?? 20, 1), 50),
  });
}

function parseInventoryDate(value: string | null | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
