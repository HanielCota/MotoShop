import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SecureCardFields, type SecureCardHandle } from "./secure-card-fields";
vi.mock("next/script", () => ({
  default: function MockScript({ onReady }: { onReady: () => void }) {
    useEffect(() => {
      onReady();
    }, [onReady]);
    return null;
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup() {
  const listeners = new Map<string, (event: { bin?: string }) => void>();
  const fieldUnmount = vi.fn();
  const token = vi.fn(async () => ({ id: "a".repeat(32) }));
  const getPaymentMethods = vi.fn(async () => ({
    results: [{ id: "visa", payment_type_id: "credit_card", settings: [] }],
  }));
  const client = {
    fields: {
      create: (type: string) => ({
        mount: vi.fn(),
        unmount: fieldUnmount,
        update: vi.fn(),
        on: (event: string, fn: (event: { bin?: string }) => void) => listeners.set(`${type}:${event}`, fn),
      }),
      createCardToken: token,
    },
    getPaymentMethods,
    getIssuers: vi.fn(async () => [{ id: 25, name: "Emissor teste" }]),
  };
  vi.stubGlobal("MercadoPago", function MercadoPago() {
    return client;
  });
  const ref = createRef<SecureCardHandle>();
  const view = render(<SecureCardFields publicKey="TEST-public-key" ref={ref} />);
  return { ...view, ref, listeners, token, fieldUnmount, getPaymentMethods };
}
function handle(ref: { current: SecureCardHandle | null }) {
  if (!ref.current) throw new Error("SecureCardFields handle was not attached");
  return ref.current;
}
it("tokenizes with hosted fields and sends only non-PCI holder data to the SDK", async () => {
  const test = setup();
  await waitFor(() => expect(test.listeners.has("cardNumber:binChange")).toBe(true));
  await act(async () => {
    for (const type of ["cardNumber", "expirationDate", "securityCode"]) test.listeners.get(`${type}:ready`)?.({});
    test.listeners.get("cardNumber:binChange")?.({ bin: "12345678" });
  });
  fireEvent.change(screen.getByLabelText("Nome no cartão"), { target: { value: "Titular Teste" } });
  fireEvent.change(screen.getByLabelText("CPF do titular"), { target: { value: "19119119100" } });
  expect(await handle(test.ref).tokenize()).toEqual({
    paymentMethodId: "visa",
    paymentToken: "a".repeat(32),
    issuerId: "25",
  });
  expect(test.token).toHaveBeenCalledWith({
    cardholderName: "Titular Teste",
    identificationType: "CPF",
    identificationNumber: "19119119100",
  });
  expect(test.container.querySelectorAll("input")).toHaveLength(2);
  test.unmount();
});
it("blocks submission while secure fields are not ready", async () => {
  const test = setup();
  await expect(handle(test.ref).tokenize()).rejects.toThrow("Aguarde");
  expect(test.token).not.toHaveBeenCalled();
});
it("disposes hosted fields when switching back to Pix", async () => {
  const test = setup();
  await waitFor(() => expect(test.listeners.size).toBeGreaterThan(0));
  cleanup();
  expect(test.fieldUnmount).toHaveBeenCalledTimes(3);
});
