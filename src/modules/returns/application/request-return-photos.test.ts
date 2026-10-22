import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    orderItem: { findUnique: vi.fn(), aggregate: vi.fn() },
    returnRequest: { findUnique: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    item: vi.fn(),
    existing: vi.fn(),
    attachedPhoto: vi.fn(),
    transaction: vi.fn(),
    verifyPhotos: vi.fn(),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({
  db: {
    orderItem: { findFirst: mocks.item },
    returnRequest: { findUnique: mocks.existing },
    returnRequestPhoto: { findFirst: mocks.attachedPhoto },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./return-photo-uploads", () => ({ verifyReturnPhotos: mocks.verifyPhotos }));

import { Prisma } from "@/generated/prisma/client";

import { requestReturn } from "./request-return";

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
}

const photos = [{ key: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg", fileId: "file-1" }];
const input = {
  orderNumber: "MS-1",
  orderItemId: "item-1",
  quantity: 1,
  reason: "DAMAGED",
  idempotencyKey: "return-1",
  identity: { userId: "buyer-1" },
  photos,
};
const item = {
  id: "item-1",
  sellerOrderId: "seller-order-1",
  sellerId: "seller-1",
  quantity: 1,
  totalAmountInCents: 200,
  sellerOrder: {
    orderId: "order-1",
    status: "DELIVERED",
    itemsSubtotalInCents: 200,
    discountAmountInCents: 0,
    order: { orderNumber: "MS-1" },
  },
  returnItems: [],
};
const verified = [{ storageKey: photos[0]?.key, contentType: "image/jpeg", sizeInBytes: 1024, sortOrder: 0 }];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((callback) => callback(mocks.tx));
  mocks.item.mockResolvedValue(item);
  mocks.existing.mockResolvedValue(null);
  mocks.verifyPhotos.mockResolvedValue(verified);
  mocks.tx.returnRequest.findUnique.mockResolvedValue(null);
  mocks.tx.orderItem.findUnique.mockResolvedValue(item);
  mocks.tx.orderItem.aggregate.mockResolvedValue({ _sum: { totalAmountInCents: 200 } });
  mocks.tx.returnRequest.create.mockImplementation(({ data }) => ({
    ...data,
    id: "return-created",
    items: [data.items.create],
    order: { orderNumber: "MS-1" },
  }));
});

describe("return photos", () => {
  it("saves the verified photos with the return, tagged with the store that owns the order", async () => {
    await requestReturn(input);

    expect(mocks.verifyPhotos).toHaveBeenCalledWith("item-1", photos);
    expect(mocks.tx.returnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          photos: { create: [{ ...verified[0], sellerId: "seller-1" }] },
        }),
      }),
    );
  });

  it("checks the photos in ImageKit before opening the database transaction", async () => {
    mocks.verifyPhotos.mockRejectedValue(new Error("A imagem enviada não corresponde ao arquivo autorizado."));

    await expect(requestReturn(input)).rejects.toThrow("não corresponde");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a return without photos when the customer sends none", async () => {
    mocks.verifyPhotos.mockResolvedValue([]);

    await requestReturn({ ...input, photos: [] });

    const data = mocks.tx.returnRequest.create.mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("photos");
  });

  it("does not look at photos for another customer's order", async () => {
    mocks.item.mockResolvedValue(null);

    await expect(requestReturn(input)).rejects.toThrow("Item do pedido não encontrado");
    expect(mocks.verifyPhotos).not.toHaveBeenCalled();
  });

  it("refuses with a clear message when another return saved the same photo first", async () => {
    mocks.transaction.mockRejectedValue(uniqueViolation());
    mocks.attachedPhoto.mockResolvedValue({ id: "photo-1" });

    await expect(requestReturn(input)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Esta foto já faz parte de outra devolução.",
    });
    expect(mocks.attachedPhoto).toHaveBeenCalledWith({
      where: { storageKey: { in: [photos[0]?.key] } },
      select: { id: true },
    });
  });

  it("keeps the original error when the unique violation is not about the photos", async () => {
    const violation = uniqueViolation();
    mocks.transaction.mockRejectedValue(violation);
    mocks.attachedPhoto.mockResolvedValue(null);

    await expect(requestReturn(input)).rejects.toBe(violation);
  });
});
