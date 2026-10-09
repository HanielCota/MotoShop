import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";
import type { ModerationKind } from "../queries/moderation-queue";

type ModerationUpdate = {
  where: { id: string; hiddenAt: null | { not: null } };
  data: { hiddenAt: Date | null };
};

export async function moderateContent(input: { kind: ModerationKind; id: string; hide: boolean; actorUserId: string }) {
  return db.$transaction(async (tx) => {
    const update: ModerationUpdate = {
      data: { hiddenAt: input.hide ? new Date() : null },
      where: { id: input.id, hiddenAt: input.hide ? null : { not: null } },
    };
    const { path, entityType } = await updateModeratedContent(tx, input, update);

    await tx.auditLog.create({
      data: {
        action: input.hide ? "PUBLIC_CONTENT_HIDDEN" : "PUBLIC_CONTENT_RESTORED",
        entityType,
        entityId: input.id,
        actorUserId: input.actorUserId,
        metadata: { kind: input.kind },
      },
    });
    return { path };
  });
}

async function updateModeratedContent(
  tx: Prisma.TransactionClient,
  input: { kind: ModerationKind; id: string },
  { where, data }: ModerationUpdate,
): Promise<{ path: string; entityType: string }> {
  if (input.kind === "question") {
    const record = await tx.productQuestion.findUnique({
      where: { id: input.id },
      select: { product: { select: { slug: true } } },
    });
    if (!record) throw new ApplicationError({ code: "NOT_FOUND", message: "Pergunta não encontrada." });
    const result = await tx.productQuestion.updateMany({ where, data });
    if (result.count !== 1)
      throw new ApplicationError({ code: "CONFLICT", message: "Esta pergunta já mudou de estado." });
    return { path: `/products/${record.product.slug}`, entityType: "ProductQuestion" };
  }

  if (input.kind === "product-review") {
    const record = await tx.productReview.findUnique({
      where: { id: input.id },
      select: { product: { select: { slug: true } } },
    });
    if (!record) throw new ApplicationError({ code: "NOT_FOUND", message: "Avaliação não encontrada." });
    const result = await tx.productReview.updateMany({ where, data });
    if (result.count !== 1)
      throw new ApplicationError({ code: "CONFLICT", message: "Esta avaliação já mudou de estado." });
    return { path: `/products/${record.product.slug}`, entityType: "ProductReview" };
  }

  const record = await tx.sellerReview.findUnique({
    where: { id: input.id },
    select: { seller: { select: { store: { select: { slug: true } } } } },
  });
  if (!record) throw new ApplicationError({ code: "NOT_FOUND", message: "Avaliação não encontrada." });
  const result = await tx.sellerReview.updateMany({ where, data });
  if (result.count !== 1)
    throw new ApplicationError({ code: "CONFLICT", message: "Esta avaliação já mudou de estado." });
  return {
    path: record.seller.store ? `/loja/${record.seller.store.slug}` : "/admin/moderation",
    entityType: "SellerReview",
  };
}
