import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    orderItem: { findUnique: vi.fn(), aggregate: vi.fn() },
    returnRequest: { findUnique: vi.fn(), create: vi.fn() },
  };
  return { tx, item: vi.fn(), existing: vi.fn(), transaction: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    orderItem: { findFirst: mocks.item },
    returnRequest: { findUnique: mocks.existing },
    $transaction: mocks.transaction,
  },
}));
import { requestReturn } from "./request-return";
const input = {
  orderNumber: "MS-1",
  orderItemId: "item-1",
  quantity: 1,
  reason: "Defeito",
  idempotencyKey: "return-1",
  identity: { userId: "buyer-1" },
};
const item = {
  id: "item-1",
  sellerOrderId: "seller-order-1",
  sellerId: "seller-1",
  quantity: 2,
  totalAmountInCents: 199,
  sellerOrder: {
    orderId: "order-1",
    status: "DELIVERED",
    itemsSubtotalInCents: 200,
    discountAmountInCents: 1,
    order: { orderNumber: "MS-1" },
  },
  returnItems: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.item.mockResolvedValue(item);
  mocks.existing.mockResolvedValue(null);
  mocks.tx.returnRequest.findUnique.mockResolvedValue(null);
  mocks.tx.orderItem.findUnique.mockResolvedValue(item);
  mocks.tx.orderItem.aggregate.mockResolvedValue({ _sum: { totalAmountInCents: 199 } });
  mocks.tx.returnRequest.create.mockImplementation(({ data }) => ({
    ...data,
    id: "return-created",
    items: [data.items.create],
    order: { orderNumber: "MS-1" },
  }));
});
describe("return quantity and amount boundaries", () => {
  it("blocks historical gross snapshots that did not allocate the coupon", async () => {
    mocks.tx.orderItem.aggregate.mockResolvedValue({ _sum: { totalAmountInCents: 200 } });
    await expect(requestReturn(input)).rejects.toThrow("valores deste pedido");
    expect(mocks.tx.returnRequest.create).not.toHaveBeenCalled();
  });
  it("counts already refunded quantities and rejects a second return", async () => {
    mocks.tx.orderItem.findUnique.mockResolvedValue({
      ...item,
      returnItems: [{ quantity: 2, returnRequest: { status: "REFUNDED", amountInCents: 199 } }],
    });
    await expect(requestReturn(input)).rejects.toThrow("quantidade");
    expect(mocks.tx.returnRequest.create).not.toHaveBeenCalled();
  });
  it("refunds only the remaining cents on the last quantity", async () => {
    mocks.tx.orderItem.findUnique.mockResolvedValue({
      ...item,
      returnItems: [{ quantity: 1, returnRequest: { status: "REFUNDED", amountInCents: 99 } }],
    });
    await requestReturn(input);
    expect(mocks.tx.returnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountInCents: 100 }) }),
    );
  });
  it("revalidates cancellation state after obtaining the lock", async () => {
    mocks.tx.orderItem.findUnique.mockResolvedValue({
      ...item,
      sellerOrder: { ...item.sellerOrder, status: "CANCELLATION_REQUESTED" },
    });
    await expect(requestReturn(input)).rejects.toThrow("status");
    expect(mocks.tx.returnRequest.create).not.toHaveBeenCalled();
  });
  it.each(["PAID", "PROCESSING", "SHIPPED"])("rejects a return while the seller order is %s", async (status) => {
    mocks.item.mockResolvedValue({ ...item, sellerOrder: { ...item.sellerOrder, status } });
    await expect(requestReturn(input)).rejects.toThrow("após a entrega");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects when the delivery status changes before the lock is obtained", async () => {
    mocks.tx.orderItem.findUnique.mockResolvedValue({
      ...item,
      sellerOrder: { ...item.sellerOrder, status: "SHIPPED" },
    });
    await expect(requestReturn(input)).rejects.toThrow("status");
    expect(mocks.tx.returnRequest.create).not.toHaveBeenCalled();
  });
  it("returns a concurrent replay without consuming quantity again", async () => {
    mocks.tx.returnRequest.findUnique.mockResolvedValue({
      id: "prior",
      orderId: "order-1",
      status: "REQUESTED",
      items: [{ orderItemId: "item-1", quantity: 1 }],
      order: { orderNumber: "MS-1" },
    });
    await expect(requestReturn(input)).resolves.toMatchObject({ id: "prior" });
    expect(mocks.tx.returnRequest.create).not.toHaveBeenCalled();
  });
  it("does not look up another customer's item without identity scope", async () => {
    mocks.item.mockResolvedValue(null);
    await expect(requestReturn(input)).rejects.toThrow("não encontrado");
    expect(mocks.item).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1", sellerOrder: { order: { orderNumber: "MS-1", userId: "buyer-1" } } },
      }),
    );
  });
});
