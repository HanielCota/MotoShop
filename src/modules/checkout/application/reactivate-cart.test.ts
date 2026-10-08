import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { reactivateCartAfterPaymentFailure } from "./reactivate-cart";

const cart = { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() };
const tx = { cart } as never;

beforeEach(() => {
  vi.resetAllMocks();
  cart.findUnique.mockResolvedValue({ status: "CONVERTED", userId: "user-1", guestAccessTokenHash: null });
  cart.findFirst.mockResolvedValue(null);
  cart.updateMany.mockResolvedValue({ count: 1 });
});

it("reactivates the converted cart when the customer has no other active cart", async () => {
  await expect(reactivateCartAfterPaymentFailure(tx, "cart-1")).resolves.toBe(true);
  expect(cart.findFirst).toHaveBeenCalledWith({ where: { userId: "user-1", status: "ACTIVE" }, select: { id: true } });
  expect(cart.updateMany).toHaveBeenCalledWith({
    where: { id: "cart-1", status: "CONVERTED" },
    data: { status: "ACTIVE" },
  });
});

it("keeps a newer active cart and leaves the converted one alone", async () => {
  cart.findFirst.mockResolvedValue({ id: "cart-2" });
  await expect(reactivateCartAfterPaymentFailure(tx, "cart-1")).resolves.toBe(false);
  expect(cart.updateMany).not.toHaveBeenCalled();
});

it("matches guest carts by their guest token hash", async () => {
  cart.findUnique.mockResolvedValue({ status: "CONVERTED", userId: null, guestAccessTokenHash: "guest-hash" });
  await reactivateCartAfterPaymentFailure(tx, "cart-1");
  expect(cart.findFirst).toHaveBeenCalledWith({
    where: { guestAccessTokenHash: "guest-hash", status: "ACTIVE" },
    select: { id: true },
  });
});

it("ignores carts that are not converted", async () => {
  cart.findUnique.mockResolvedValue({ status: "ACTIVE", userId: "user-1", guestAccessTokenHash: null });
  await expect(reactivateCartAfterPaymentFailure(tx, "cart-1")).resolves.toBe(false);
  expect(cart.updateMany).not.toHaveBeenCalled();
});
