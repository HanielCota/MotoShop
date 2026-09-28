import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));
vi.mock("@/config/env", () => ({
  env: {
    IMAGEKIT_PUBLIC_KEY: "public_test",
    IMAGEKIT_PRIVATE_KEY: "private_test",
    IMAGEKIT_URL_ENDPOINT: "https://ik.imagekit.io/example",
    RESEND_API_KEY: "example-resend-key",
    EMAIL_FROM: "Moto Shop <teste@example.com>",
    MERCADO_PAGO_ACCESS_TOKEN: "TEST-local-mocked-provider",
    MELHOR_ENVIO_TOKEN: "example-shipping-token",
    MELHOR_ENVIO_API_URL: "https://sandbox.melhorenvio.com.br",
    MELHOR_ENVIO_USER_AGENT: "Moto Shop (teste@example.com)",
  },
}));

import { ImageKitStorageProvider } from "./storage/imagekit-storage-provider";
import { ResendEmailProvider } from "./email/resend-email-provider";
import { MelhorEnvioProvider } from "./shipping/melhor-envio-provider";
import { MercadoPagoProvider } from "./payment/mercado-pago-provider";

afterEach(() => {
  vi.unstubAllGlobals();
  sendEmail.mockReset();
});
it.each([
  ["refunded", "refunded", "REFUNDED"],
  ["approved", "partially_refunded", "PARTIALLY_REFUNDED"],
] as const)("maps provider refund status %s/%s", async (status, detail, expected) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 123, status, status_detail: detail }) }),
  );
  expect((await new MercadoPagoProvider().getPayment("123")).status).toBe(expected);
});
it("never treats a missing or malformed shipping price as free shipping", async () => {
  const prices = [null, undefined, "", "invalid", -1, Infinity, 0];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => prices.map((price, index) => ({ id: index + 1, name: "PAC", price })),
    }),
  );
  const quotes = await new MelhorEnvioProvider().quote({
    fromPostalCode: "01001000",
    toPostalCode: "01310000",
    products: [],
  });
  expect(quotes).toHaveLength(1);
  expect(quotes[0]).toMatchObject({ serviceCode: "7", priceInCents: 0 });
});

it("signs a direct ImageKit upload without exposing the private key", async () => {
  const result = await new ImageKitStorageProvider().createUploadUrl({
    key: "products/seller-1/product-1/photo.webp",
    contentType: "image/webp",
  });
  expect(result.url).toBe("https://upload.imagekit.io/api/v2/files/upload");
  expect(result.fields).toMatchObject({
    folder: "/products/seller-1/product-1",
    fileName: "photo.webp",
  });
  const [header, payload, signature] = result.fields.token!.split(".");
  expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toMatchObject({ alg: "HS256", kid: "public_test" });
  const claims = JSON.parse(Buffer.from(payload!, "base64url").toString());
  expect(claims).toMatchObject({
    folder: result.fields.folder,
    fileName: result.fields.fileName,
    overwriteFile: false,
    useUniqueFileName: false,
  });
  expect(claims.exp - claims.iat).toBe(300);
  expect(signature).toBe(createHmac("sha256", "private_test").update(`${header}.${payload}`).digest("base64url"));
  const modified = Buffer.from(
    JSON.stringify({ ...claims, folder: "/products/another-seller", overwriteFile: true }),
  ).toString("base64url");
  expect(signature).not.toBe(createHmac("sha256", "private_test").update(`${header}.${modified}`).digest("base64url"));
  expect(JSON.stringify(result)).not.toContain("private_test");
});

it("accepts only the expected uploaded image path and metadata", async () => {
  const asset = {
    fileId: "123456789012345678901234",
    filePath: "/products/seller-1/product-1/photo.webp",
    fileType: "image",
    mime: "image/webp",
    size: 1024,
  };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => asset });
  vi.stubGlobal("fetch", fetchMock);
  const provider = new ImageKitStorageProvider();
  const input = {
    key: "products/seller-1/product-1/photo.webp",
    fileId: asset.fileId,
    maxSizeInBytes: 5 * 1024 * 1024,
    contentTypes: ["image/webp"],
  };

  await expect(provider.verifyImage(input)).resolves.toBeUndefined();
  expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://api.imagekit.io/v1/files/${asset.fileId}/details`);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ...asset, filePath: "/products/seller-2/photo.webp" }),
  });
  await expect(provider.verifyImage(input)).rejects.toThrow(/não corresponde/i);
});

it("deletes only an ImageKit asset with the exact storage path", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      {
        fileId: "aaaaaaaaaaaaaaaaaaaaaaaa",
        filePath: "/products/other/photo.webp",
        fileType: "image",
        mime: "image/webp",
        size: 100,
      },
      {
        fileId: "bbbbbbbbbbbbbbbbbbbbbbbb",
        filePath: "/products/seller-1/photo.webp",
        fileType: "image",
        mime: "image/webp",
        size: 100,
      },
    ],
  });
  vi.stubGlobal("fetch", fetchMock);

  await new ImageKitStorageProvider().deleteObject({ key: "products/seller-1/photo.webp" });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.imagekit.io/v1/files/bbbbbbbbbbbbbbbbbbbbbbbb");
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
});

it("sends a transactional email through the configured provider", async () => {
  sendEmail.mockResolvedValue({ data: { id: "email-test-id" }, error: null });
  const result = await new ResendEmailProvider().send({
    to: "buyer@example.test",
    subject: "Pedido de teste",
    react: "Conteúdo de teste",
    idempotencyKey: "notification-test",
  });
  expect(result).toEqual({ id: "email-test-id" });
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: "Moto Shop <teste@example.com>",
      to: "buyer@example.test",
      subject: "Pedido de teste",
    }),
    { idempotencyKey: "notification-test" },
  );
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
    products: [
      {
        id: "SKU-1",
        widthInCm: 10,
        heightInCm: 10,
        lengthInCm: 10,
        weightInKg: 0.5,
        insuranceValueInCents: 10000,
        quantity: 1,
      },
    ],
  });
  expect(quotes).toMatchObject([
    {
      provider: "MELHOR_ENVIO",
      serviceCode: "1",
      carrier: "Correios",
      service: "PAC",
      priceInCents: 2345,
      estimatedDeliveryDays: 4,
    },
  ]);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate");
});
