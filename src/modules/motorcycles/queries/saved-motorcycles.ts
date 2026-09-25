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
