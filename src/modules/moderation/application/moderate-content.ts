import "server-only";

import { db } from "@/lib/database";
import { ApplicationError } from "@/shared/errors/application-error";
import type { ModerationKind } from "../queries/moderation-queue";

export async function moderateContent(input: { kind: ModerationKind; id: string; hide: boolean; actorUserId: string }) {
  return db.$transaction(async (tx) => {
    const data = { hiddenAt: input.hide ? new Date() : null };
    const where = { id: input.id, hiddenAt: input.hide ? null : { not: null } };
    let path: string;
    let entityType: string;

    if (input.kind === "question") {
      const record = await tx.productQuestion.findUnique({
        where: { id: input.id },
        select: { product: { select: { slug: true } } },
      });
      if (!record) throw new ApplicationError({ code: "NOT_FOUND", message: "Pergunta não encontrada." });
      const result = await tx.productQuestion.updateMany({ where, data });
      if (result.count !== 1)
        throw new ApplicationError({ code: "CONFLICT", message: "Esta pergunta já mudou de estado." });
      path = `/products/${record.product.slug}`;
      entityType = "ProductQuestion";
    } else if (input.kind === "product-review") {
      const record = await tx.productReview.findUnique({
        where: { id: input.id },
        select: { product: { select: { slug: true } } },
      });
      if (!record) throw new ApplicationError({ code: "NOT_FOUND", message: "Avaliação não encontrada." });
      const result = await tx.productReview.updateMany({ where, data });
      if (result.count !== 1)
        throw new ApplicationError({ code: "CONFLICT", message: "Esta avaliação já mudou de estado." });
      path = `/products/${record.product.slug}`;
      entityType = "ProductReview";
    } else {
      const record = await tx.sellerReview.findUnique({
        where: { id: input.id },
        select: { seller: { select: { store: { select: { slug: true } } } } },
      });
      if (!record) throw new ApplicationError({ code: "NOT_FOUND", message: "Avaliação não encontrada." });
      const result = await tx.sellerReview.updateMany({ where, data });
      if (result.count !== 1)
        throw new ApplicationError({ code: "CONFLICT", message: "Esta avaliação já mudou de estado." });
      path = record.seller.store ? `/loja/${record.seller.store.slug}` : "/admin/moderation";
      entityType = "SellerReview";
    }

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
