import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { payment: { findMany: mocks.findMany } } }));

import { listLongUnresolvedPayments } from "./unresolved-payments";

beforeEach(() => vi.clearAllMocks());

it("lists only old pending charges without a provider id on orders still awaiting payment (L-09)", async () => {
  mocks.findMany.mockResolvedValue([]);
  const now = new Date("2026-10-14T12:00:00.000Z");

  await listLongUnresolvedPayments(now);

  expect(mocks.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        provider: "MERCADO_PAGO",
        externalId: null,
        status: { in: ["PENDING", "PROCESSING"] },
        order: { status: "PENDING_PAYMENT" },
        createdAt: { lt: new Date("2026-10-14T06:00:00.000Z") },
      },
      take: 50,
    }),
  );
});
