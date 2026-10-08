import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  env: {
    MELHOR_ENVIO_API_URL: "https://sandbox.melhorenvio.com.br",
    MELHOR_ENVIO_USER_AGENT: "O Moto Shop (suporte@example.com)",
  },
}));

import { MelhorEnvioProvider } from "./melhor-envio-provider";

afterEach(() => vi.unstubAllGlobals());

describe("MelhorEnvioProvider shipment reconciliation", () => {
  it("uses the seller-scoped token for a quote without exposing a platform-wide token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([{ id: 1, name: "PAC", price: "12.50", company: { name: "Correios" } }]));
    vi.stubGlobal("fetch", fetchMock);

    await new MelhorEnvioProvider().quote(
      { fromPostalCode: "01001000", toPostalCode: "01310000", products: [] },
      "seller-specific-token",
    );

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer seller-specific-token" });
  });

  it("treats a valid empty quote array as no available shipping services", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json([])));

    await expect(
      new MelhorEnvioProvider().quote(
        { fromPostalCode: "01001000", toPostalCode: "01310000", products: [] },
        "seller-specific-token",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects a successful response with an invalid quote payload instead of hiding it as no rates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ id: 1, price: "12.50" })));

    await expect(
      new MelhorEnvioProvider().quote(
        { fromPostalCode: "01001000", toPostalCode: "01310000", products: [] },
        "seller-specific-token",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 502 });
  });

  it("places the platform order tag under options as required by the provider API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: "cart-shipment-1", recipient: { name: "Cliente Teste", document: "12345678900" } }),
      )
      .mockResolvedValueOnce(Response.json({ result: "paid", address: "Rua confidencial, 1" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MelhorEnvioProvider();

    const result = await provider.createShipment(
      {
        sellerOrderId: "seller-order-1",
        serviceCode: "1",
        from: {} as never,
        to: {} as never,
        products: [],
        volumes: [],
        insuranceValueInCents: 10_000,
        tags: [{ tag: "MS-202610-0001" }],
        quote: {
          provider: "MELHOR_ENVIO",
          serviceCode: "1",
          carrier: "Transportadora",
          service: "Expresso",
          priceInCents: 2500,
          raw: {},
        },
      },
      "seller-specific-token",
    );

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer seller-specific-token",
      ),
    ).toBe(true);
    expect(requestBody.options.tags).toEqual([{ tag: "MS-202610-0001" }]);
    expect(requestBody.tags).toBeUndefined();
    expect(result.providerMetadata).toEqual({ checkoutResult: "paid" });
    expect(JSON.stringify(result.providerMetadata)).not.toContain("12345678900");
    expect(JSON.stringify(result.providerMetadata)).not.toContain("Rua confidencial");
  });

  it("persists only allowlisted scalar shipment and tracking metadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ status: "released", protocol: "PROTO-1", recipient: { document: "12345678900" } }),
      )
      .mockResolvedValueOnce(
        Response.json([{ status: "posted", tracking_code: "TRACK-1", recipient: { phone: "11999999999" } }]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MelhorEnvioProvider();

    const generated = await provider.generateShipment("external-1", "seller-specific-token");
    const tracked = await provider.track("external-1", "seller-specific-token");

    expect(generated.providerMetadata).toEqual({ status: "released", protocol: "PROTO-1" });
    expect(tracked).toMatchObject({ trackingCode: "TRACK-1", providerMetadata: { status: "posted" } });
    expect(JSON.stringify([generated, tracked])).not.toContain("12345678900");
    expect(JSON.stringify([generated, tracked])).not.toContain("11999999999");
    expect(
      fetchMock.mock.calls.every(
        ([, init]) => (init?.headers as Record<string, string>).Authorization === "Bearer seller-specific-token",
      ),
    ).toBe(true);
  });

  it("never falls back to a platform token when seller OAuth credentials are missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(new MelhorEnvioProvider().generateShipment("external-1", " ")).rejects.toMatchObject({
      code: "CONFIGURATION_ERROR",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads shipment details from the authenticated account and checks the returned ID", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id: "external-1", options: { tags: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MelhorEnvioProvider();

    await expect(provider.getShipmentDetails("external-1", "seller-specific-token")).resolves.toMatchObject({
      id: "external-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.melhorenvio.com.br/api/v2/me/orders/external-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer seller-specific-token" }),
      }),
    );
  });

  it("rejects a provider response with a mismatched shipment ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ id: "other-id" })));
    const provider = new MelhorEnvioProvider();

    await expect(provider.getShipmentDetails("external-1", "seller-specific-token")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it.each([
    [400, true],
    [422, true],
    [401, true],
    [408, false],
    [409, false],
    [429, false],
    [500, false],
  ])("classifies provider HTTP %i as definitive=%s", async (status, definitive) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ message: "erro" }, { status })));

    await expect(
      new MelhorEnvioProvider().generateShipment("external-1", "seller-specific-token"),
    ).rejects.toMatchObject({
      definitive,
      providerStatus: status,
      message: "O Melhor Envio não conseguiu gerar a etiqueta.",
    });
  });

  it("uses an operation-specific message when label checkout fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ id: "cart-shipment-1" }))
        .mockResolvedValueOnce(Response.json({ message: "saldo insuficiente" }, { status: 422 })),
    );

    await expect(
      new MelhorEnvioProvider().createShipment(
        {
          sellerOrderId: "seller-order-1",
          serviceCode: "1",
          from: {},
          to: {},
          products: [],
          volumes: [],
          insuranceValueInCents: 0,
          quote: { provider: "MELHOR_ENVIO", serviceCode: "1", carrier: "C", service: "S", priceInCents: 1, raw: {} },
        },
        "seller-specific-token",
      ),
    ).rejects.toMatchObject({ message: "O Melhor Envio não conseguiu comprar a etiqueta.", definitive: true });
  });
});
