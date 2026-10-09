"use server";

import { addMonths } from "date-fns";
import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

const subscriptionSchema = z.object({
  sellerId: z.string().min(1, "Selecione a loja."),
  months: z.coerce
    .number({ error: "Informe a duração em meses, de 1 a 12." })
    .int("Informe a duração em meses, de 1 a 12.")
    .min(1, "Informe a duração em meses, de 1 a 12.")
    .max(12, "Informe a duração em meses, de 1 a 12."),
});

export type SubscriptionActionState = { error?: string; success?: string };

export async function activateVipSubscriptionAction(
  _previousState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const session = await requireAdminAccess();
  const parsed = subscriptionSchema.safeParse({
    sellerId: formData.get("sellerId"),
    months: formData.get("months"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do plano VIP." };

  try {
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "sellers" WHERE id = ${parsed.data.sellerId} FOR UPDATE`;
      const seller = await tx.seller.findFirst({
        where: { id: parsed.data.sellerId, status: { in: ["APPROVED", "ACTIVE"] } },
      });
      if (!seller)
        throw new ApplicationError({ code: "CONFLICT", message: "Loja não encontrada ou ainda não aprovada." });

      const activeSubscription = await tx.sellerSubscription.findFirst({
        where: {
          sellerId: seller.id,
          status: "ACTIVE",
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        orderBy: { endsAt: "desc" },
      });
      const startsAt = activeSubscription?.startsAt ?? now;
      const baseEnd = activeSubscription && activeSubscription.endsAt > now ? activeSubscription.endsAt : now;
      const endsAt = addMonths(baseEnd, parsed.data.months);

      if (activeSubscription) {
        await tx.sellerSubscription.update({ where: { id: activeSubscription.id }, data: { endsAt } });
        await tx.auditLog.create({
          data: {
            action: "SELLER_VIP_RENEWED",
            entityType: "SELLER_SUBSCRIPTION",
            entityId: activeSubscription.id,
            actorUserId: session.user.id,
            metadata: {
              sellerId: seller.id,
              months: parsed.data.months,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
        return;
      }

      const subscription = await tx.sellerSubscription.create({
        data: { sellerId: seller.id, startsAt, endsAt, plan: "VIP", status: "ACTIVE" },
      });
      await tx.auditLog.create({
        data: {
          action: "SELLER_VIP_ACTIVATED",
          entityType: "SELLER_SUBSCRIPTION",
          entityId: subscription.id,
          actorUserId: session.user.id,
          metadata: {
            sellerId: seller.id,
            months: parsed.data.months,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    });

    revalidatePath("/admin", "layout");
    revalidatePath("/seller", "layout");
    revalidatePath("/products");
    return { success: "Plano VIP ativado/renovado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
