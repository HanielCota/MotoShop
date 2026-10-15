import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ count: vi.fn(), lock: vi.fn() }));

import { assertPendingOrderCap } from "./pending-order-cap";
import type { Prisma } from "@/generated/prisma/client";

const tx = { order: { count: mocks.count }, $queryRaw: mocks.lock } as unknown as Prisma.TransactionClient;

beforeEach(() => vi.clearAllMocks());

it("counts recent orders awaiting payment for the same CPF (M-06)", async () => {
  mocks.count.mockResolvedValue(2);
  const now = new Date("2026-10-14T12:00:00.000Z");

  await expect(assertPendingOrderCap(tx, "52998224725", now)).resolves.toBeUndefined();
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.count.mock.invocationCallOrder[0] ?? 0);
  expect(mocks.count).toHaveBeenCalledWith({
    where: {
      customerTaxId: "52998224725",
      status: "PENDING_PAYMENT",
      createdAt: { gt: new Date("2026-10-13T12:00:00.000Z") },
    },
  });
});

it("refuses a new checkout once the CPF has three orders waiting for payment", async () => {
  mocks.count.mockResolvedValue(3);

  await expect(assertPendingOrderCap(tx, "52998224725")).rejects.toMatchObject({
    code: "CONFLICT",
    message: expect.stringContaining("aguardando pagamento"),
  });
});
