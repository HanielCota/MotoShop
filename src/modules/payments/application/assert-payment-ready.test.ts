import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/config/env", () => ({ env: { MERCADO_PAGO_PUBLIC_KEY: "public-key" } }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({ mercadoPagoProvider: {} }));

import type { PaymentProvider } from "@/shared/payment/payment-provider";

import { getCheckoutPaymentAvailability } from "./assert-payment-ready";

function providerSupporting(supportsSellerCount: PaymentProvider["supportsSellerCount"]) {
  return { supportsSellerCount } as unknown as PaymentProvider;
}

beforeEach(() => logger.error.mockClear());

describe("getCheckoutPaymentAvailability", () => {
  it("reports an unsupported seller count as unavailable without logging", () => {
    const result = getCheckoutPaymentAvailability(
      2,
      providerSupporting(() => false),
    );

    expect(result).toEqual({ available: false, cardPublicKey: undefined });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs unexpected failures instead of hiding them behind the unavailable state", () => {
    const failure = new TypeError("provider exploded");
    const result = getCheckoutPaymentAvailability(
      1,
      providerSupporting(() => {
        throw failure;
      }),
    );

    expect(result).toEqual({ available: false, cardPublicKey: undefined });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "checkout.payment_availability.failed", error: failure }),
    );
  });

  it("exposes only the public key when the provider is ready", () => {
    expect(
      getCheckoutPaymentAvailability(
        1,
        providerSupporting(() => true),
      ),
    ).toEqual({
      available: true,
      cardPublicKey: "public-key",
    });
  });
});
