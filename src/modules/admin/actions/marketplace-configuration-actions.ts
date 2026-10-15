"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { logActionFailure } from "@/shared/errors/action-error";
import { readSubmittedValues } from "@/shared/forms/submitted-values";

import {
  commissionSchema,
  DEFAULT_COMMISSION_ERROR,
  readDefaultCommissionInput,
} from "../schemas/marketplace-commission";

export type CommissionActionState = { error?: string; success?: string; values?: { commissionPercent: string } };

export async function updateMarketplaceCommissionAction(
  _previousState: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const session = await requireAdminAccess();
  const parsed = commissionSchema.safeParse(readDefaultCommissionInput(formData));
  const values = readSubmittedValues(formData, ["commissionPercent"] as const);
  if (!parsed.success) return { error: DEFAULT_COMMISSION_ERROR, values };

  try {
    await db.$transaction(
      async (tx) => {
        const previous = await tx.marketplaceConfiguration.findUnique({ where: { key: "default" } });
        await tx.marketplaceConfiguration.upsert({
          where: { key: "default" },
          create: { key: "default", defaultCommissionBps: parsed.data.defaultCommissionBps },
          update: { defaultCommissionBps: parsed.data.defaultCommissionBps },
        });
        await tx.auditLog.create({
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
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidatePath("/admin", "layout");
    return { success: "Comissão padrão atualizada." };
  } catch (error) {
    logActionFailure("updateMarketplaceCommissionAction", error);
    return { error: "Não foi possível atualizar a comissão padrão.", values };
  }
}
