import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), send: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { order: { findUnique: mocks.findUnique } } }));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "https://motoshop.example" }));
vi.mock("@/modules/orders/infrastructure/guest-order-link-token", () => ({
  createGuestOrderLinkToken: (orderId: string) => `link-token-for-${orderId}`,
}));
vi.mock("@/modules/notifications/application/send-notification-email", () => ({ sendNotificationEmail: mocks.send }));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: (_config: unknown, handler: unknown) => handler },
}));

import { sendGuestOrderConfirmation } from "./guest-order-confirmation-workflow";

type Handler = (input: {
  event: { data: unknown };
  step: { run: (name: string, fn: () => unknown) => unknown };
}) => Promise<unknown>;
const handler = sendGuestOrderConfirmation as unknown as Handler;
const step = { run: vi.fn((_name: string, fn: () => unknown) => fn()) };

const guestOrder = {
  id: "order-1",
  orderNumber: "MS-202610-AB12",
  status: "PENDING_PAYMENT",
  userId: null,
  guestAccessTokenHash: "guest-hash",
  customerName: "Ana",
  customerEmail: "ana@exemplo.com.br",
  totalAmountInCents: 18690,
};

describe("sendGuestOrderConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ status: "SENT", providerId: "email-1" });
  });

  it("e-mails the guest the access link, idempotent per order, without returning the token", async () => {
    mocks.findUnique.mockResolvedValue(guestOrder);

    const result = await handler({
      event: { data: { orderId: "order-1", orderNumber: guestOrder.orderNumber } },
      step,
    });

    expect(result).toEqual({ status: "SENT", providerId: "email-1" });
    expect(JSON.stringify(result)).not.toContain("link-token");
    const input = mocks.send.mock.calls[0]?.[0] as {
      eventKey: string;
      kind: string;
      to: string;
      subject: string;
      react: ReactElement<{ orderLink: string }>;
    };
    expect(input.eventKey).toBe("order-guest-confirmation:order-1");
    expect(input.kind).toBe("ORDER_GUEST_CONFIRMATION");
    expect(input.to).toBe("ana@exemplo.com.br");
    expect(input.subject).toBe("Pedido recebido · MS-202610-AB12");
    expect(isValidElement(input.react)).toBe(true);
    expect(input.react.props.orderLink).toBe(
      "https://motoshop.example/orders/MS-202610-AB12/access?token=link-token-for-order-1",
    );
  });

  it.each([
    ["claimed by an account", { userId: "user-1" }],
    ["without a guest token", { guestAccessTokenHash: null }],
    ["cancelled", { status: "CANCELLED" }],
  ])("skips an order %s", async (_label, overrides) => {
    mocks.findUnique.mockResolvedValue({ ...guestOrder, ...overrides });

    await expect(handler({ event: { data: { orderId: "order-1", orderNumber: "MS-1" } }, step })).resolves.toEqual({
      status: "SKIPPED",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects an invalid event without retrying", async () => {
    await expect(handler({ event: { data: { orderNumber: "MS-1" } }, step })).rejects.toThrow(/Invalid/);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
