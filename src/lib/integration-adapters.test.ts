import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const sendEmail = vi.hoisted(() => vi.fn());
const logInfo = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { info: logInfo, error: vi.fn(), warn: vi.fn() } }));
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
    EMAIL_FROM: "O Moto Shop <teste@example.com>",
    MERCADO_PAGO_ACCESS_TOKEN: "TEST-local-mocked-provider",
    MELHOR_ENVIO_API_URL: "https://sandbox.melhorenvio.com.br",
    MELHOR_ENVIO_USER_AGENT: "O Moto Shop (teste@example.com)",
  },
}));

import { ImageKitStorageProvider, signImageKitUrl } from "./storage/imagekit-storage-provider";
import { ResendEmailProvider, SKIPPED_RESERVED_DOMAIN_ID } from "./email/resend-email-provider";
import { MelhorEnvioProvider } from "./shipping/melhor-envio-provider";
import { MercadoPagoProvider } from "./payment/mercado-pago-provider";

afterEach(() => {
  vi.unstubAllGlobals();
  sendEmail.mockReset();
  logInfo.mockReset();
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
  const quotes = await new MelhorEnvioProvider().quote(
    {
      fromPostalCode: "01001000",
      toPostalCode: "01310000",
      products: [],
    },
    "seller-sandbox-token",
  );
  expect(quotes).toHaveLength(1);
  expect(quotes[0]).toMatchObject({ serviceCode: "7", priceInCents: 0 });
});

it("signs a direct ImageKit upload without exposing the private key", async () => {
  const result = await new ImageKitStorageProvider().createUploadUrl({
    key: "products/seller-1/product-1/photo.webp",
    contentType: "image/webp",
    maxSizeInBytes: 5 * 1024 * 1024,
  });
  expect(result.url).toBe("https://upload.imagekit.io/api/v2/files/upload");
  expect(result.fields).toMatchObject({
    folder: "/products/seller-1/product-1",
    fileName: "photo.webp",
  });
  const [header, payload, signature] = defined(result.fields.token).split(".");
  expect(JSON.parse(Buffer.from(defined(header), "base64url").toString())).toMatchObject({
    alg: "HS256",
    kid: "public_test",
  });
  const claims = JSON.parse(Buffer.from(defined(payload), "base64url").toString());
  expect(claims).toMatchObject({
    folder: result.fields.folder,
    fileName: result.fields.fileName,
    overwriteFile: false,
    useUniqueFileName: false,
    checks: '"file.mime" IN ["image/webp"] AND "file.size" <= 5242880',
  });
  expect(result.fields.checks).toBe(claims.checks);
  expect(claims.exp - claims.iat).toBe(300);
  expect(signature).toBe(createHmac("sha256", "private_test").update(`${header}.${payload}`).digest("base64url"));
  const modified = Buffer.from(
    JSON.stringify({ ...claims, folder: "/products/another-seller", overwriteFile: true }),
  ).toString("base64url");
  expect(signature).not.toBe(createHmac("sha256", "private_test").update(`${header}.${modified}`).digest("base64url"));
  expect(JSON.stringify(result)).not.toContain("private_test");
});

it("rejects invalid ImageKit upload constraints before issuing a signed token", async () => {
  const provider = new ImageKitStorageProvider();
  await expect(
    provider.createUploadUrl({
      key: "products/seller-1/product-1/photo.webp",
      contentType: "image/webp",
      maxSizeInBytes: 20 * 1024 * 1024 + 1,
    }),
  ).rejects.toThrow();
  await expect(
    provider.createUploadUrl({
      key: "products/seller-1/product-1/photo.webp",
      contentType: "image/svg+xml",
      maxSizeInBytes: 5 * 1024 * 1024,
    }),
  ).rejects.toThrow();
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

it("lists the old files of a folder and its subfolders, skips folders, and bulk-deletes by id", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [
      { fileId: "f1", filePath: "/returns/item/a.jpg", createdAt: "2026-10-20T10:00:00.000Z", size: 1 },
      { type: "folder", folderId: "d1", folderPath: "/returns/item", createdAt: "2026-10-20T10:00:00.000Z" },
    ],
  });
  vi.stubGlobal("fetch", fetchMock);
  const provider = new ImageKitStorageProvider();

  const files = await provider.listFilesCreatedBefore({
    folder: "returns",
    createdBefore: new Date("2026-10-22T07:41:00.000Z"),
    skip: 100,
    limit: 100,
  });
  await provider.deleteFilesById(["f1"]);

  const listUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
  expect(listUrl.origin + listUrl.pathname).toBe("https://api.imagekit.io/v1/files");
  // The path parameter is one level only; the path operator of searchQuery covers the subfolders.
  expect(Object.fromEntries(listUrl.searchParams)).toEqual({
    searchQuery: 'path : "/returns/" AND createdAt < "2026-10-22T07:41:00.000Z"',
    sort: "ASC_CREATED",
    skip: "100",
    limit: "100",
  });
  expect(files).toEqual([
    { fileId: "f1", filePath: "/returns/item/a.jpg", createdAt: new Date("2026-10-20T10:00:00.000Z") },
  ]);
  expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.imagekit.io/v1/files/batch/deleteByFileIds");
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({ fileIds: ["f1"] }),
    headers: expect.objectContaining({ "Content-Type": "application/json" }),
  });
});

it("sends a transactional email through the configured provider", async () => {
  sendEmail.mockResolvedValue({ data: { id: "email-test-id" }, error: null });
  const result = await new ResendEmailProvider().send({
    to: "buyer@cliente-moto.com.br",
    subject: "Pedido de teste",
    react: "Conteúdo de teste",
    idempotencyKey: "notification-test",
  });
  expect(result).toEqual({ id: "email-test-id" });
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      from: "O Moto Shop <teste@example.com>",
      to: ["buyer@cliente-moto.com.br"],
      subject: "Pedido de teste",
    }),
    { idempotencyKey: "notification-test" },
  );
});

it.each(["qa-123@example.test", "review.cliente@example.test", "someone@example.com", "a@x.invalid"])(
  "never sends to the reserved test address %s",
  async (to) => {
    const result = await new ResendEmailProvider().send({ to, subject: "Confirme seu e-mail", react: "Conteúdo" });

    expect(result).toEqual({ id: SKIPPED_RESERVED_DOMAIN_ID });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logInfo).toHaveBeenCalledWith({ event: "email.reserved_domain_skipped", skipped: 1, remaining: 0 });
    expect(JSON.stringify(logInfo.mock.calls)).not.toContain(to);
  },
);

it("drops reserved addresses and still delivers to the real ones", async () => {
  sendEmail.mockResolvedValue({ data: { id: "email-mixed" }, error: null });

  await new ResendEmailProvider().send({
    to: ["buyer@cliente-moto.com.br", "qa-9@example.test"],
    subject: "Pedido de teste",
    react: "Conteúdo",
  });

  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: ["buyer@cliente-moto.com.br"] }), undefined);
});

it("maps a Melhor Envio sandbox quote into cents without exposing provider details to checkout", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => [{ id: 1, name: "PAC", company: { name: "Correios" }, custom_price: "23.45", delivery_time: 4 }],
  });
  vi.stubGlobal("fetch", fetchMock);
  const quotes = await new MelhorEnvioProvider().quote(
    {
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
    },
    "seller-sandbox-token",
  );
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

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}

it("signs a private ImageKit upload so the browser cannot turn it public", async () => {
  const result = await new ImageKitStorageProvider().createUploadUrl({
    key: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg",
    contentType: "image/jpeg",
    maxSizeInBytes: 5 * 1024 * 1024,
    isPrivate: true,
  });
  const [, payload] = defined(result.fields.token).split(".");
  const claims = JSON.parse(Buffer.from(defined(payload), "base64url").toString());

  expect(claims.isPrivateFile).toBe(true);
  expect(result.fields.isPrivateFile).toBe("true");
});

it("refuses a return photo that ImageKit did not store as private", async () => {
  const asset = {
    fileId: "123456789012345678901234",
    filePath: "/returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg",
    fileType: "image",
    mime: "image/jpeg",
    size: 1024,
    isPrivateFile: false,
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => asset }));
  const input = {
    key: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg",
    fileId: asset.fileId,
    maxSizeInBytes: 5 * 1024 * 1024,
    contentTypes: ["image/jpeg"],
    requirePrivate: true,
  };

  await expect(new ImageKitStorageProvider().verifyAsset(input)).rejects.toThrow(/não corresponde/i);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...asset, isPrivateFile: true }) }),
  );
  await expect(new ImageKitStorageProvider().verifyAsset(input)).resolves.toMatchObject({ contentType: "image/jpeg" });
});

it("signs a private file URL with HMAC-SHA1 of the path plus the expiry", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const expiresAt = Math.floor(now.getTime() / 1000) + 600;
  const path = "tr:w-160/returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg";
  const signature = createHmac("sha1", "private_test").update(`${path}${expiresAt}`).digest("hex");

  const url = signImageKitUrl({
    endpoint: "https://ik.imagekit.io/example/",
    privateKey: "private_test",
    key: "returns/item-1/0b8a8f0e-6c38-4f8e-9f3c-1d2e3f4a5b6c.jpg",
    expiresInSeconds: 600,
    width: 160,
    now,
  });

  expect(url).toBe(`https://ik.imagekit.io/example/${path}?ik-t=${expiresAt}&ik-s=${signature}`);
  expect(url).not.toContain("private_test");
});

it("refuses to sign a path outside the expected storage keys", () => {
  expect(() =>
    signImageKitUrl({
      endpoint: "https://ik.imagekit.io/example",
      privateKey: "private_test",
      key: "../outra-pasta/arquivo.jpg?x=1",
      expiresInSeconds: 600,
      now: new Date(),
    }),
  ).toThrow();
});
