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

import {
  approveProductAction,
  archiveProductAction,
  createProductAction,
  rejectProductAction,
  restoreProductAction,
  submitProductAction,
  updateProductAction,
} from "./product-actions";

const PRODUCT_ID = "cproducta0000000000000001";
const OTHER_PRODUCT_ID = "cproductsellerb0000000002";
const REVISION = "2026-10-01T12:00:00.000Z";

const readyProduct = {
  id: PRODUCT_ID,
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
  it("rejects an empty product form before touching the database", async () => {
    const form = new FormData();
    form.set("name", "");
    const result = await createProductAction({}, form);

    expect(result.error).toBe("Informe o nome do produto.");
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

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
      revision: REVISION,
    }))
      data.set(key, value);
    const result = await updateProductAction(OTHER_PRODUCT_ID, {}, data);
    expect(result.error).toBeTruthy();
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: OTHER_PRODUCT_ID, sellerId: "seller-a", status: { in: ["DRAFT", "REJECTED"] } },
      }),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("keeps a draft out of review when its category is inactive", async () => {
    mocks.productFindFirst.mockResolvedValue({ ...readyProduct, status: "DRAFT", category: { active: false } });

    const result = await submitProductAction(PRODUCT_ID);

    expect(result.error).toMatch(/categoria.*não está ativa/i);
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });

  it("submits only the current seller's editable product", async () => {
    mocks.productFindFirst.mockResolvedValue({ ...readyProduct, status: "DRAFT" });

    const result = await submitProductAction(PRODUCT_ID);

    expect(result.success).toBe("Produto enviado para aprovação.");
    expect(mocks.productFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: PRODUCT_ID, sellerId: "seller-a" }) }),
    );
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sellerId: "seller-a" }) }),
    );
  });

  it("restores an archived product with an atomic seller-scoped write and audit", async () => {
    mocks.productFindFirst.mockResolvedValue({ id: PRODUCT_ID, status: "ARCHIVED" });

    await restoreProductAction(PRODUCT_ID);

    expect(mocks.productUpdateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, sellerId: "seller-a", status: "ARCHIVED" },
      data: { status: "DRAFT", rejectionReason: null },
    });
    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "PRODUCT_RESTORED", entityId: PRODUCT_ID, actorUserId: "owner-a" }),
      }),
    );
  });

  it("archives a draft with an atomic seller-scoped write and audit", async () => {
    mocks.productFindFirst.mockResolvedValue({ id: PRODUCT_ID, status: "DRAFT" });

    await archiveProductAction(PRODUCT_ID);

    expect(mocks.productUpdateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, sellerId: "seller-a", status: "DRAFT" },
      data: { status: "ARCHIVED" },
    });
    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "PRODUCT_ARCHIVED", entityId: PRODUCT_ID, actorUserId: "owner-a" }),
      }),
    );
  });

  it("does not audit or revalidate when another request already archived the product", async () => {
    mocks.productFindFirst.mockResolvedValue({ id: PRODUCT_ID, status: "DRAFT" });
    mocks.productUpdateMany.mockResolvedValue({ count: 0 });

    await archiveProductAction(PRODUCT_ID);

    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not audit or revalidate when another request already restored the product", async () => {
    mocks.productFindFirst.mockResolvedValue({ id: PRODUCT_ID, status: "ARCHIVED" });
    mocks.productUpdateMany.mockResolvedValue({ count: 0 });

    await restoreProductAction(PRODUCT_ID);

    expect(mocks.productUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PRODUCT_ID, sellerId: "seller-a", status: "ARCHIVED" } }),
    );
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not approve a product from a suspended seller", async () => {
    mocks.productFindFirst.mockResolvedValue({ ...readyProduct, seller: { status: "SUSPENDED" } });

    const result = await approveProductAction(PRODUCT_ID);

    expect(result.error).toMatch(/loja precisa estar ativa/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("approves and audits a valid product in one transaction", async () => {
    mocks.productFindFirst.mockResolvedValue(readyProduct);

    const result = await approveProductAction(PRODUCT_ID);

    expect(result.success).toBe("Produto aprovado.");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.productUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: PRODUCT_ID, status: "SUBMITTED" }) }),
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
    const result = await rejectProductAction(PRODUCT_ID, reason);

    expect(result.error).toMatch(/já foi revisado/i);
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("refuses an oversized rejection reason before touching the product", async () => {
    const reason = new FormData();
    reason.set("reason", "x".repeat(1001));
    const result = await rejectProductAction(PRODUCT_ID, reason);

    expect(result.error).toMatch(/no máximo 1000 caracteres/);
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed product ids before reading the catalog", async () => {
    const result = await submitProductAction("../product");
    await archiveProductAction("x");
    await restoreProductAction("");

    expect(result.error).toBe("Produto não encontrado.");
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
    expect(mocks.productUpdateMany).not.toHaveBeenCalled();
  });
});

describe("product edit revision", () => {
  function editForm(revision?: string) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      name: "Capacete teste",
      slug: "capacete-teste",
      description: "Descrição para teste de concorrência",
      categoryId: "cmf8w8m4p0000s6o5zj2q8v3k",
      brandId: "cmf8w8m4p0001s6o5zj2q8v3k",
      variantTitle: "M",
      sku: "TEST",
      price: "100,00",
      stock: "1",
      weightInGrams: "1000",
    }))
      data.set(key, value);
    if (revision) data.set("revision", revision);
    return data;
  }

  it("requires the revision loaded by the editor", async () => {
    const result = await updateProductAction(PRODUCT_ID, {}, editForm());

    expect(result.error).toMatch(/recarregue a página/i);
    expect(mocks.productFindFirst).not.toHaveBeenCalled();
  });

  it("rejects a save based on an outdated revision without writing", async () => {
    mocks.productFindFirst.mockResolvedValue({
      id: PRODUCT_ID,
      updatedAt: new Date("2026-10-01T12:05:00.000Z"),
      variants: [],
    });

    const result = await updateProductAction(PRODUCT_ID, {}, editForm(REVISION));

    expect(result.error).toBe("O produto foi alterado por outra pessoa. Recarregue a página.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
