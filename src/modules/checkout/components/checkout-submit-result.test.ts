import { describe, expect, it } from "vitest";

import { isTerminalCheckoutFailure } from "./checkout-submit-result";

describe("isTerminalCheckoutFailure", () => {
  it("detects declined or cancelled payments", () => {
    expect(isTerminalCheckoutFailure({ error: "Pagamento recusado pelo emissor." })).toBe(true);
    expect(isTerminalCheckoutFailure({ orderNumber: "MS-1", paymentStatus: "rejected" } as never)).toBe(true);
    expect(isTerminalCheckoutFailure({ orderNumber: "MS-1", status: "CANCELLED" } as never)).toBe(true);
    expect(isTerminalCheckoutFailure({ error: "x", code: "PAYMENT_DECLINED" } as never)).toBe(true);
    expect(isTerminalCheckoutFailure({ error: "x", retryable: false } as never)).toBe(true);
  });

  it("keeps the idempotency key for uncertain or validation failures", () => {
    expect(isTerminalCheckoutFailure({ orderNumber: "MS-1" })).toBe(false);
    expect(isTerminalCheckoutFailure({ error: "Informe um CPF válido." })).toBe(false);
    expect(isTerminalCheckoutFailure({ error: "Não foi possível confirmar o pagamento. Consulte seu pedido." })).toBe(false);
    expect(isTerminalCheckoutFailure({ orderNumber: "MS-1", paymentStatus: "PENDING" } as never)).toBe(false);
  });
});
