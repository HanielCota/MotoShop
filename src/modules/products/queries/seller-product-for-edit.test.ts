import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { product: { findFirst: mocks.findFirst } } }));

import { getSellerProductForEdit, isSellerProductEditable } from "./seller-product-for-edit";

beforeEach(() => {
  mocks.findFirst.mockReset();
});

it("finds an editable product only among this store's drafts and rejected products with an active variant", async () => {
  mocks.findFirst.mockResolvedValue({ id: "product-1" });

  const editable = await isSellerProductEditable("seller-1", "product-1");

  expect(editable).toBe(true);
  expect(mocks.findFirst).toHaveBeenCalledWith({
    where: {
      id: "product-1",
      sellerId: "seller-1",
      status: { in: ["DRAFT", "REJECTED"] },
      variants: { some: { active: true } },
    },
    select: { id: true },
  });
});

it("says a product is not editable when the store has no such product", async () => {
  mocks.findFirst.mockResolvedValue(null);

  await expect(isSellerProductEditable("seller-1", "product-of-another-store")).resolves.toBe(false);
});

it("loads the full product with the same store and status rule as the check", async () => {
  mocks.findFirst.mockResolvedValue(null);

  await getSellerProductForEdit("seller-1", "product-1");

  expect(mocks.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "product-1", sellerId: "seller-1", status: { in: ["DRAFT", "REJECTED"] } },
    }),
  );
});
