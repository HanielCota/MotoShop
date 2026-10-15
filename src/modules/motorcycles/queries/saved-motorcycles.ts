import "server-only";

import { db } from "@/lib/database";

export async function listSavedMotorcycles(userId: string) {
  return db.savedMotorcycle.findMany({
    where: { userId },
    select: {
      id: true,
      motorcycleFitmentId: true,
      isPrimary: true,
      motorcycleFitment: {
        select: {
          version: true,
          displacementCc: true,
          year: true,
          motorcycleModel: {
            select: { name: true, active: true, manufacturer: { select: { name: true, active: true } } },
          },
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
}

export async function getPrimarySavedMotorcycle(userId: string) {
  return db.savedMotorcycle.findFirst({
    where: {
      userId,
      isPrimary: true,
      motorcycleFitment: { motorcycleModel: { active: true, manufacturer: { active: true } } },
    },
    select: {
      motorcycleFitmentId: true,
      motorcycleFitment: {
        select: {
          version: true,
          displacementCc: true,
          year: true,
          motorcycleModel: { select: { name: true, manufacturer: { select: { name: true } } } },
        },
      },
    },
  });
}

/**
 * Public products compatible with each fitment, with the catalog rules: approved products of
 * approved or active sellers. Fitments without any match are absent from the map.
 */
export async function countCompatibleProductsByFitment(fitmentIds: readonly string[]): Promise<Map<string, number>> {
  if (fitmentIds.length === 0) return new Map();

  const groups = await db.productCompatibility.groupBy({
    by: ["motorcycleFitmentId"],
    where: {
      motorcycleFitmentId: { in: [...fitmentIds] },
      product: { status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.motorcycleFitmentId, group._count._all]));
}
