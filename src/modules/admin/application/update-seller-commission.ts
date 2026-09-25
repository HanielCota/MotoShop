import "server-only";
import { z } from "zod";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";
import { sellerCommissionSchema } from "../schemas/seller-commission";

export async function updateSellerCommission(actorUserId: string, input: z.infer<typeof sellerCommissionSchema>) {
  return db.$transaction(async (tx) => {
    const updated = await tx.seller.updateMany({
      where: { id: input.sellerId, commissionBpsOverride: input.previousCommissionBpsOverride },
      data: { commissionBpsOverride: input.commissionBpsOverride },
    });
    if (updated.count !== 1)
      throw new ApplicationError({
        code: "CONFLICT",
        statusCode: 409,
        message: "A loja não foi encontrada ou a comissão mudou. Atualize a página antes de salvar.",
      });
    await tx.auditLog.create({
      data: {
        action: "SELLER_COMMISSION_UPDATED",
        entityType: "Seller",
        entityId: input.sellerId,
        actorUserId,
        metadata: {
          previousCommissionBps: input.previousCommissionBpsOverride,
          nextCommissionBps: input.commissionBpsOverride,
        },
      },
    });
    // Orders retain their commission snapshots; no historical orders are updated.
  });
}
