import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ count: vi.fn() }));
vi.mock("@/lib/database", () => ({ db: { order: { count: mocks.count } } }));

import { assertPendingOrderCap } from "./pending-order-cap";

beforeEach(() => vi.clearAllMocks());

it("counts recent orders awaiting payment for the same CPF (M-06)", async () => {
  mocks.count.mockResolvedValue(2);
  const now = new Date("2026-10-14T12:00:00.000Z");

  await expect(assertPendingOrderCap("52998224725", now)).resolves.toBeUndefined();
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

  await expect(assertPendingOrderCap("52998224725")).rejects.toMatchObject({
    code: "CONFLICT",
    message: expect.stringContaining("aguardando pagamento"),
  });
});
