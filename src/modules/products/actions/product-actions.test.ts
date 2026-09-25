import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const productFindFirst = vi.fn();
  const productUpdateMany = vi.fn();
  const auditLogCreate = vi.fn();
  return {
    productFindFirst,
    productUpdateMany,
    auditLogCreate,
    transaction: vi.fn(
      async (
        callback: (tx: {
          product: { updateMany: typeof productUpdateMany };
          auditLog: { create: typeof auditLogCreate };
        }) => Promise<unknown>,
      ) => callback({ product: { updateMany: productUpdateMany }, auditLog: { create: auditLogCreate } }),
    ),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/database", () => ({
  db: {
    product: { findFirst: mocks.productFindFirst, updateMany: mocks.productUpdateMany },
    auditLog: { create: mocks.auditLogCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: vi.fn(async () => ({
    seller: { id: "seller-a" },
    store: { id: "store-a" },
    session: { user: { id: "owner-a" } },
  })),
  requireAdminAccess: vi.fn(async () => ({ user: { id: "admin-a" } })),
}));

import { approveProductAction, rejectProductAction, submitProductAction, updateProductAction } from "./product-actions";

const readyProduct = {
  id: "product-a",
  status: "SUBMITTED",
  seller: { status: "ACTIVE" },
  category: { active: true },
  brand: { active: true },
  variants: [{ active: true, priceInCents: 12000 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.productUpdateMany.mockResolvedValue({ count: 1 });
  mocks.auditLogCreate.mockResolvedValue({ id: "audit-a" });
});

describe("product review workflow", () => {
  it("does not edit another seller's product or an uneditable product", async () => {
    mocks.productFindFirst.mockResolvedValue(null);
    const data = new FormData();
    for (const [key, value] of Object.entries({
      name: "Capacete teste",
      slug: "capacete-teste",
      description: "Descrição para teste de isolamento",
      categoryId: "cmf8w8m4p0000s6o5zj2q8v3k",
      brandId: "cmf8w8m4p0001s6o5zj2q8v3k",
      variantTitle: "M",
      sku: "TEST",
      price: "100,00",
      stock: "1",
      promotionalPrice: "80,00",
      weightInGrams: "1000",
    }))
      data.set(key, value);
    const result = await updateProductAction("other-product", {}, data);
    expect(result.error).toBeTruthy();
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other-product", sellerId: "seller-a", status: { in: ["DRAFT", "REJECTED"] } },
      }),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps a draft out of review when its category is inactive", async () => {
    mocks.productFindFirst.mockResolvedValue({ ...readyProduct, status: "DRAFT", category: { active: false } });

    const result = await submitProductAction("product-a");

    expect(result.error).toMatch(/categoria.*não está ativa/i);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });

  it("submits only the current seller's editable product", async () => {
    mocks.productFindFirst.mockResolvedValue({ ...readyProduct, status: "DRAFT" });

    const result = await submitProductAction("product-a");

    expect(result.success).toBe("Produto enviado para aprovação.");
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "product-a", sellerId: "seller-a" }) }),
    );
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sellerId: "seller-a" }) }),
    );
  });

  it("does not approve a product from a suspended seller", async () => {
    mocks.productFindFirst.mockResolvedValue({ ...readyProduct, seller: { status: "SUSPENDED" } });

    const result = await approveProductAction("product-a");

    expect(result.error).toMatch(/loja precisa estar ativa/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("approves and audits a valid product in one transaction", async () => {
    mocks.productFindFirst.mockResolvedValue(readyProduct);

    const result = await approveProductAction("product-a");

    expect(result.success).toBe("Produto aprovado.");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "product-a", status: "SUBMITTED" }) }),
    );
    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "PRODUCT_APPROVED", actorUserId: "admin-a" }),
      }),
    );
  });

  it("does not create an audit entry when another admin reviewed first", async () => {
    mocks.productFindFirst.mockResolvedValue(readyProduct);
    mocks.productUpdateMany.mockResolvedValue({ count: 0 });

    const reason = new FormData();
    reason.set("reason", "Descrição insuficiente");
    const result = await rejectProductAction("product-a", reason);

    expect(result.error).toMatch(/já foi revisado/i);
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });
});
