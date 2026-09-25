import { afterEach, expect, it, vi } from "vitest";

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class { emails = { send: sendEmail }; } }));
vi.mock("@/config/env", () => ({
  env: {
    R2_ACCOUNT_ID: "example-account",
    R2_ACCESS_KEY_ID: "example-key",
    R2_SECRET_ACCESS_KEY: "example-secret",
    R2_BUCKET_NAME: "example-bucket",
    RESEND_API_KEY: "example-resend-key",
    EMAIL_FROM: "Moto Shop <teste@example.com>",
    MELHOR_ENVIO_TOKEN: "example-shipping-token",
    MELHOR_ENVIO_API_URL: "https://sandbox.melhorenvio.com.br",
    MELHOR_ENVIO_USER_AGENT: "Moto Shop (teste@example.com)",
  },
}));

import { R2StorageProvider } from "./storage/r2-storage-provider";
import { ResendEmailProvider } from "./email/resend-email-provider";
import { MelhorEnvioProvider } from "./shipping/melhor-envio-provider";

afterEach(() => {
  vi.unstubAllGlobals();
  sendEmail.mockReset();
});

it("signs a direct R2 upload for the requested object and content type", async () => {
  const result = await new R2StorageProvider().createUploadUrl({
    key: "products/seller-1/product-1/photo.webp",
    contentType: "image/webp",
  });
  const url = new URL(result.url);
  expect(url.origin).toBe("https://example-bucket.example-account.r2.cloudflarestorage.com");
  expect(url.pathname).toBe("/products/seller-1/product-1/photo.webp");
  expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
  expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
});

it("sends a transactional email through the configured provider", async () => {
  sendEmail.mockResolvedValue({ data: { id: "email-test-id" }, error: null });
  const result = await new ResendEmailProvider().send({
    to: "buyer@example.test",
    subject: "Pedido de teste",
    react: "Conteúdo de teste",
  });
  expect(result).toEqual({ id: "email-test-id" });
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
    from: "Moto Shop <teste@example.com>",
    to: "buyer@example.test",
    subject: "Pedido de teste",
  }));
});

it("maps a Melhor Envio sandbox quote into cents without exposing provider details to checkout", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ id: 1, name: "PAC", company: { name: "Correios" }, custom_price: "23.45", delivery_time: 4 }],
  });
  vi.stubGlobal("fetch", fetchMock);
  const quotes = await new MelhorEnvioProvider().quote({
    fromPostalCode: "01001000",
    toPostalCode: "01310000",
    products: [{ id: "SKU-1", widthInCm: 10, heightInCm: 10, lengthInCm: 10, weightInKg: 0.5, insuranceValueInCents: 10000, quantity: 1 }],
  });
  expect(quotes).toMatchObject([{ provider: "MELHOR_ENVIO", serviceCode: "1", carrier: "Correios", service: "PAC", priceInCents: 2345, estimatedDeliveryDays: 4 }]);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
});
