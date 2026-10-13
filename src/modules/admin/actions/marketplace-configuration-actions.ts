"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { logActionFailure } from "@/shared/errors/action-error";
import { readSubmittedValues } from "@/shared/forms/submitted-values";

import { parseCommissionPercent } from "../schemas/seller-commission";

// O formulário recebe percentual ("12,50"); o banco guarda basis points (1250).
const commissionSchema = z.object({
  defaultCommissionBps: z.number().int().min(0).max(10_000),
});

export type CommissionActionState = { error?: string; success?: string; values?: { commissionPercent: string } };

export async function updateMarketplaceCommissionAction(
  _previousState: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const session = await requireAdminAccess();
  const parsed = commissionSchema.safeParse({
    defaultCommissionBps: parseCommissionPercent(formData.get("commissionPercent")),
  });
  const values = readSubmittedValues(formData, ["commissionPercent"] as const);
  if (!parsed.success) return { error: "Informe uma comissão entre 0% e 100%.", values };

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
