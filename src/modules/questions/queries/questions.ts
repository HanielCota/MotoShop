import { db } from "@/lib/database";
import { parseDateFilter } from "@/lib/date-filter";

import type { sellerQuestionSortValues } from "../search-params";

export async function listSellerQuestions(
  sellerId: string,
  input: {
    filter?: "ALL" | "UNANSWERED" | "ANSWERED";
    q?: string | null;
    from?: string | null;
    to?: string | null;
    sort?: (typeof sellerQuestionSortValues)[number];
    page?: number;
  } = {},
) {
  const pageSize = 20;
  const requestedPage = Math.max(input.page ?? 1, 1);
  const query = input.q?.trim().slice(0, 100);
  const from = parseDateFilter(input.from);
  const to = parseDateFilter(input.to, true);
  const where = {
    sellerId,
    hiddenAt: null,
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
    ...(input.filter === "UNANSWERED" ? { answeredAt: null } : {}),
    ...(input.filter === "ANSWERED" ? { answeredAt: { not: null } } : {}),
    ...(query
      ? {
          OR: [
            { question: { contains: query, mode: "insensitive" as const } },
            { product: { name: { contains: query, mode: "insensitive" as const } } },
            { product: { slug: { contains: query, mode: "insensitive" as const } } },
            { askedBy: { email: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [total, questions] = await Promise.all([
    db.productQuestion.count({ where }),
    db.productQuestion.findMany({
      where,
      include: {
        product: { select: { name: true, slug: true } },
        askedBy: { select: { name: true, email: true } },
        answeredBy: { select: { name: true } },
      },
      orderBy: input.sort === "oldest" ? [{ createdAt: "asc" }] : [{ createdAt: "desc" }],
      skip: (requestedPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  return { questions, total, page: Math.min(requestedPage, pageCount), pageCount };
}
