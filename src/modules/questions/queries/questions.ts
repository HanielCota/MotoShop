import { db } from "@/lib/database";

import type { sellerQuestionSortValues } from "../search-params";

function parseQuestionDate(value: string | null | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parts = value.split("-");
  if (parts.length !== 3) return undefined;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

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
  const from = parseQuestionDate(input.from);
  const to = parseQuestionDate(input.to, true);
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
