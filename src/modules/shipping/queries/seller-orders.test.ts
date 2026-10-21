import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: { sellerOrder: { count: mocks.count, findMany: mocks.findMany } },
}));

import { listSellerOrders } from "./seller-orders";

const input = { sort: "newest", status: "ALL", shipmentStatus: "ALL", page: 1 } as const;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.count.mockResolvedValue(0);
  mocks.findMany.mockResolvedValue([]);
});

async function findManyArgsFor(sellerId: string) {
  await listSellerOrders(sellerId, input);
  const args = mocks.findMany.mock.calls[0]?.[0];
  if (!args) throw new Error("findMany não foi chamado");
  return args;
}

describe("listSellerOrders after-sales (UX-13)", () => {
  it("scopes the orders and every after-sales relation to the session seller", async () => {
    const args = await findManyArgsFor("seller-a");

    expect(args.where.sellerId).toBe("seller-a");
    expect(args.include.cancellationRequests.where).toEqual({ sellerId: "seller-a" });
    expect(args.include.returnRequests.where).toEqual({ sellerId: "seller-a" });
    expect(args.include.returnRequests.select.items.where).toEqual({ sellerId: "seller-a" });
    expect(args.include.disputes.where).toEqual({ sellerId: "seller-a" });
  });

  it("never reuses another store's id when a second seller asks", async () => {
    await listSellerOrders("seller-a", input);
    await listSellerOrders("seller-b", input);
    const secondCall = JSON.stringify(mocks.findMany.mock.calls[1]?.[0]);

    expect(secondCall).toContain('"sellerId":"seller-b"');
    expect(secondCall).not.toContain("seller-a");
  });

  it("keeps the Admin's internal notes out of the seller's view", async () => {
    const args = await findManyArgsFor("seller-a");

    expect(args.include.cancellationRequests.select).not.toHaveProperty("adminNote");
    expect(args.include.returnRequests.select).not.toHaveProperty("adminNote");
    expect(args.include.disputes.select).not.toHaveProperty("resolutionNote");
  });
});
