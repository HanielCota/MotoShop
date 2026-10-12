import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSellerAccess: vi.fn(),
  createOwnShippingMethod: vi.fn(),
  setOwnShippingMethodActive: vi.fn(),
  advanceOwnShipment: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireSellerAccess: mocks.requireSellerAccess }));
vi.mock("../application/own-shipping", () => ({
  createOwnShippingMethod: mocks.createOwnShippingMethod,
  setOwnShippingMethodActive: mocks.setOwnShippingMethodActive,
  advanceOwnShipment: mocks.advanceOwnShipment,
}));

import {
  advanceOwnShipmentAction,
  createOwnShippingMethodAction,
  setOwnShippingMethodActiveAction,
} from "./own-shipping-actions";

const methodId = "cmf8w8m4p0000s6o5zj2q8v3k";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSellerAccess.mockRejectedValue(new Error("FORBIDDEN"));
});

it("requires SELLER_MANAGE before creating or toggling a shipping method", async () => {
  await expect(createOwnShippingMethodAction({}, new FormData())).rejects.toThrow("FORBIDDEN");
  await expect(setOwnShippingMethodActiveAction({}, formData({ id: methodId, active: "true" }))).rejects.toThrow(
    "FORBIDDEN",
  );

  expect(mocks.requireSellerAccess).toHaveBeenNthCalledWith(1, "SELLER_MANAGE");
  expect(mocks.requireSellerAccess).toHaveBeenNthCalledWith(2, "SELLER_MANAGE");
  expect(mocks.createOwnShippingMethod).not.toHaveBeenCalled();
  expect(mocks.setOwnShippingMethodActive).not.toHaveBeenCalled();
});

it("requires ORDER_UPDATE before advancing an own shipment", async () => {
  await expect(advanceOwnShipmentAction({}, formData({ sellerOrderId: methodId, status: "SHIPPED" }))).rejects.toThrow(
    "FORBIDDEN",
  );

  expect(mocks.requireSellerAccess).toHaveBeenCalledWith("ORDER_UPDATE");
  expect(mocks.advanceOwnShipment).not.toHaveBeenCalled();
});

it("scopes the shipping method change to the authenticated seller", async () => {
  mocks.requireSellerAccess.mockResolvedValue({ seller: { id: "seller-a" }, session: { user: { id: "user-a" } } });

  const result = await setOwnShippingMethodActiveAction({}, formData({ id: methodId, active: "false" }));

  expect(result.success).toBeDefined();
  expect(mocks.setOwnShippingMethodActive).toHaveBeenCalledWith("seller-a", "user-a", methodId, false);
});

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}
