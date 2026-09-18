import "server-only";

import { db } from "@/lib/database";

export async function listActiveMotorcycleFitments() {
  return db.motorcycleFitment.findMany({
    where: { motorcycleModel: { active: true, manufacturer: { active: true } } },
    include: { motorcycleModel: { include: { manufacturer: true } } },
    orderBy: [
      { motorcycleModel: { manufacturer: { name: "asc" } } },
      { motorcycleModel: { name: "asc" } },
      { year: "desc" },
    ],
  });
}
