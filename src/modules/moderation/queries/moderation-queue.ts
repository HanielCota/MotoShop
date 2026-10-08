import "server-only";

import { db } from "@/lib/database";
import { formatCount } from "@/lib/format";

export type ModerationKind = "question" | "product-review" | "seller-review";

export async function listModerationQueue(kind: ModerationKind, requestedPage: number) {
  const pageSize = 15;
  const page = Number.isSafeInteger(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const skip = (page - 1) * pageSize;

  if (kind === "question") {
    const [total, records] = await Promise.all([
      db.productQuestion.count(),
      db.productQuestion.findMany({
        select: {
          id: true,
          question: true,
          answer: true,
          hiddenAt: true,
          createdAt: true,
          product: { select: { name: true, slug: true } },
          askedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      items: records.map((item) => ({
        id: item.id,
        text: item.question,
        detail: item.answer,
        hidden: Boolean(item.hiddenAt),
        createdAt: item.createdAt,
        context: `${item.product.name} · ${item.askedBy.name}`,
      })),
    };
  }

  if (kind === "product-review") {
    const [total, records] = await Promise.all([
      db.productReview.count(),
      db.productReview.findMany({
        select: {
          id: true,
          ratingTenths: true,
          comment: true,
          hiddenAt: true,
          createdAt: true,
          product: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      items: records.map((item) => ({
        id: item.id,
        text: item.comment || `Avaliação de ${(item.ratingTenths / 10).toFixed(1).replace(".", ",")} estrelas`,
        detail: null,
        hidden: Boolean(item.hiddenAt),
        createdAt: item.createdAt,
        context: `${item.product.name} · ${item.user.name}`,
      })),
    };
  }

  const [total, records] = await Promise.all([
    db.sellerReview.count(),
    db.sellerReview.findMany({
      select: {
        id: true,
        rating: true,
        comment: true,
        hiddenAt: true,
        createdAt: true,
        seller: { select: { store: { select: { name: true } } } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    items: records.map((item) => ({
      id: item.id,
      text: item.comment || `Avaliação de ${formatCount(item.rating, "estrela", "estrelas")}`,
      detail: null,
      hidden: Boolean(item.hiddenAt),
      createdAt: item.createdAt,
      context: `${item.seller.store?.name ?? "Loja"} · ${item.user.name}`,
    })),
  };
}
