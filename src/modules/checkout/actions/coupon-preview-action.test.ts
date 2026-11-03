import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), preview: vi.fn(), rateLimit: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({
  getCurrentSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/modules/cart/infrastructure/cart-access", () => ({ getCartIdentity: mocks.identity }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: mocks.rateLimit }));
vi.mock("@/modules/orders/infrastructure/guest-order-cookie", () => ({ setGuestOrderCookie: vi.fn() }));
vi.mock("../application/submit-checkout", () => ({ submitCheckout: vi.fn() }));
vi.mock("../application/preview-checkout-coupon", () => ({ previewCheckoutCoupon: mocks.preview }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }) }));

import { ApplicationError } from "@/shared/errors/application-error";

import { previewCheckoutCouponAction } from "./checkout-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ userId: "user-1" });
  mocks.preview.mockResolvedValue({ discountInCents: 5999 });
});

it("previews the discount for the normalized code and counts the per-customer limit by e-mail, user and CPF", async () => {
  const result = await previewCheckoutCouponAction({
    couponCode: " trilha10 ",
    customerEmail: " Cliente@Example.Test ",
    customerTaxId: "529.982.247-25",
  });

  expect(result).toEqual({ discountInCents: 5999 });
  expect(mocks.preview).toHaveBeenCalledWith(
    expect.objectContaining({
      identity: { userId: "user-1" },
      couponCode: "TRILHA10",
      customer: { email: "cliente@example.test", userId: "user-1", taxId: "52998224725" },
    }),
  );
});

it("limits previews per cart and per IP so codes cannot be guessed one after another", async () => {
  await previewCheckoutCouponAction({ couponCode: "TRILHA10", customerEmail: "a@example.test", customerTaxId: "" });

  expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "coupon-preview:user:user-1" }));
  expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "coupon-preview:ip:203.0.113.7" }));
});

it("asks for the e-mail before checking a coupon and ignores an incomplete CPF", async () => {
  expect(await previewCheckoutCouponAction({ couponCode: "TRILHA10", customerEmail: "", customerTaxId: "" })).toEqual({
    error: "Preencha o seu e-mail para aplicar o cupom.",
  });

  await previewCheckoutCouponAction({ couponCode: "TRILHA10", customerEmail: "a@example.test", customerTaxId: "529" });
  expect(mocks.preview).toHaveBeenCalledWith(
    expect.objectContaining({ customer: expect.objectContaining({ taxId: undefined }) }),
  );
});

it("shows the coupon problem from the server, such as an expired code", async () => {
  mocks.preview.mockRejectedValue(new ApplicationError({ code: "CONFLICT", message: "Este cupom expirou." }));

  expect(
    await previewCheckoutCouponAction({ couponCode: "VELHO", customerEmail: "a@example.test", customerTaxId: "" }),
  ).toEqual({ error: "Este cupom expirou." });
});
