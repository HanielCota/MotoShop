import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { payment: { findUnique: vi.fn() } } }));
vi.mock("@/lib/payment/mercado-pago-provider", () => ({ mercadoPagoProvider: {} }));
vi.mock("./reconcile-payment", () => ({ reconcileMercadoPagoPayment: vi.fn() }));
vi.mock("./release-unsent-payment", () => ({ releaseUnsentPayment: vi.fn() }));
import { releaseUnsentPayment } from "./release-unsent-payment";
import { db } from "@/lib/database";
import { reconcileMercadoPagoPayment } from "./reconcile-payment";
import { recoverPayment } from "./recover-payment";

const payment = {
  id: "local",
  provider: "MERCADO_PAGO",
  externalId: null,
  amountInCents: 12345,
  currency: "BRL",
  method: "pix",
  order: { orderNumber: "MS-123" },
};
const result = {
  externalId: "remote",
  status: "APPROVED" as const,
  providerMetadata: {
    external_reference: "MS-123",
    transaction_amount: 123.45,
    currency_id: "BRL",
    payment_method_id: "pix",
  },
};
const provider = { getPayment: vi.fn(), findPaymentByOrderNumber: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.payment.findUnique).mockResolvedValue(payment as never);
  provider.findPaymentByOrderNumber.mockResolvedValue(result);
  provider.getPayment.mockResolvedValue(result);
  vi.mocked(reconcileMercadoPagoPayment).mockResolvedValue({ orderNumber: "MS-123", status: "APPROVED" });
});
it("recovers a lost response without creating another charge", async () => {
  expect(await recoverPayment("local", provider)).toMatchObject({ outcome: "RECONCILED" });
  expect(provider.findPaymentByOrderNumber).toHaveBeenCalledWith("MS-123");
  expect(reconcileMercadoPagoPayment).toHaveBeenCalledWith({
    externalId: "remote",
    result,
    expectedPaymentId: "local",
  });
});
it("keeps reservations when search has no result", async () => {
  provider.findPaymentByOrderNumber.mockResolvedValue(null);
  expect(await recoverPayment("local", provider)).toEqual({ outcome: "UNRESOLVED" });
  expect(reconcileMercadoPagoPayment).not.toHaveBeenCalled();
});
it("keeps reservations on timeout", async () => {
  provider.findPaymentByOrderNumber.mockRejectedValue(new Error("timeout"));
  await expect(recoverPayment("local", provider)).rejects.toThrow("timeout");
  expect(reconcileMercadoPagoPayment).not.toHaveBeenCalled();
});
it.each([
  { transaction_amount: 123.46 },
  { transaction_amount: "123.45" },
  { currency_id: "USD" },
  { external_reference: "another-order" },
  { payment_method_id: "visa" },
])("refuses a mismatched payment: %j", async (metadata) => {
  provider.findPaymentByOrderNumber.mockResolvedValue({
    ...result,
    providerMetadata: { ...result.providerMetadata, ...metadata },
  });
  await expect(recoverPayment("local", provider)).rejects.toThrow("revisão");
  expect(reconcileMercadoPagoPayment).not.toHaveBeenCalled();
});
it("uses the known external id and rejects another id", async () => {
  vi.mocked(db.payment.findUnique).mockResolvedValue({ ...payment, externalId: "known" } as never);
  await expect(recoverPayment("local", provider)).rejects.toThrow("revisão");
  expect(provider.getPayment).toHaveBeenCalledWith("known");
  expect(provider.findPaymentByOrderNumber).not.toHaveBeenCalled();
});
it("does not interpret an expired QR date as a cancelled payment", async () => {
  provider.findPaymentByOrderNumber.mockResolvedValue({
    ...result,
    status: "PENDING",
    providerMetadata: { ...result.providerMetadata, date_of_expiration: "2020-01-01T00:00:00Z" },
  });
  await recoverPayment("local", provider);
  expect(reconcileMercadoPagoPayment).toHaveBeenCalledWith(
    expect.objectContaining({ result: expect.objectContaining({ status: "PENDING" }) }),
  );
});

const pendingLocal = { ...payment, status: "PENDING", order: { orderNumber: "MS-123", status: "PENDING_PAYMENT" } };
it("releases a charge that never reached the provider without searching it", async () => {
  vi.mocked(db.payment.findUnique).mockResolvedValue(pendingLocal as never);
  vi.mocked(releaseUnsentPayment).mockResolvedValue({ decision: "RELEASE_NEVER_SENT", released: true });
  expect(await recoverPayment("local", provider)).toEqual({ outcome: "RELEASED" });
  expect(provider.findPaymentByOrderNumber).not.toHaveBeenCalled();
});
it("waits while the checkout may still be sending the request", async () => {
  vi.mocked(db.payment.findUnique).mockResolvedValue(pendingLocal as never);
  vi.mocked(releaseUnsentPayment).mockResolvedValue({ decision: "WAIT", released: false });
  expect(await recoverPayment("local", provider)).toEqual({ outcome: "UNRESOLVED" });
  expect(provider.findPaymentByOrderNumber).not.toHaveBeenCalled();
});
it("keeps asking the provider when the request was sent and its outcome is unknown", async () => {
  vi.mocked(db.payment.findUnique).mockResolvedValue(pendingLocal as never);
  vi.mocked(releaseUnsentPayment).mockResolvedValue({ decision: "ASK_PROVIDER", released: false });
  provider.findPaymentByOrderNumber.mockResolvedValue(null);
  expect(await recoverPayment("local", provider)).toEqual({ outcome: "UNRESOLVED" });
  expect(provider.findPaymentByOrderNumber).toHaveBeenCalledWith("MS-123");
});
