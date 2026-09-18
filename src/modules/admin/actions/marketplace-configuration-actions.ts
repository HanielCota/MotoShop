"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";

const commissionSchema = z.object({
  defaultCommissionBps: z.coerce.number().int().min(0).max(10_000),
});

export type CommissionActionState = { error?: string; success?: string };

export async function updateMarketplaceCommissionAction(
  _previousState: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const session = await requireAdminAccess();
  const parsed = commissionSchema.safeParse({ defaultCommissionBps: formData.get("defaultCommissionBps") });
  if (!parsed.success) return { error: "Informe uma comissão entre 0% e 100%." };

  const previous = await db.marketplaceConfiguration.findUnique({ where: { key: "default" } });
  try {
    await db.$transaction([
      db.marketplaceConfiguration.upsert({
        where: { key: "default" },
        create: { key: "default", defaultCommissionBps: parsed.data.defaultCommissionBps },
        update: { defaultCommissionBps: parsed.data.defaultCommissionBps },
      }),
      db.auditLog.create({
        data: {
          action: "MARKETPLACE_COMMISSION_UPDATED",
          entityType: "MarketplaceConfiguration",
          entityId: "default",
          metadata: {
            previousCommissionBps: previous?.defaultCommissionBps ?? null,
            nextCommissionBps: parsed.data.defaultCommissionBps,
          } as Prisma.InputJsonValue,
          actorUserId: session.user.id,
        },
      }),
    ]);
    revalidatePath("/admin");
    return { success: "Comissão padrão atualizada." };
  } catch {
    return { error: "Não foi possível atualizar a comissão padrão." };
  }
}
