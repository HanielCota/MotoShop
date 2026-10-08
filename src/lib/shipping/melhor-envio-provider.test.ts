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

  it("places the platform order tag under options and sends total insurance with unit values", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: "cart-shipment-1", protocol: "ORD-1", recipient: { document: "12345678900" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MelhorEnvioProvider().addToCart(
      {
        sellerOrderId: "seller-order-1",
        serviceCode: "1",
        from: {},
        to: {},
        products: [
          {
            id: "SKU-1",
            name: "Luva",
            unitaryValueInCents: 5000,
            widthInCm: 10,
            heightInCm: 5,
            lengthInCm: 20,
            weightInKg: 0.2,
            insuranceValueInCents: 5000,
            quantity: 2,
          },
        ],
        volumes: [{ heightInCm: 10, widthInCm: 11, lengthInCm: 20, weightInKg: 0.4 }],
        insuranceValueInCents: 10_000,
        tags: [{ tag: "MS-202610-0001" }],
      },
      "seller-specific-token",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/cart");
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.options.tags).toEqual([{ tag: "MS-202610-0001" }]);
    expect(requestBody.tags).toBeUndefined();
    expect(requestBody.options.insurance_value).toBe(100);
    expect(requestBody.products).toEqual([{ name: "Luva", quantity: 2, unitary_value: 50 }]);
    expect(requestBody.volumes).toEqual([{ height: 10, width: 11, length: 20, weight: 0.4 }]);
    expect(result).toEqual({ cartItemId: "cart-shipment-1", providerMetadata: { protocol: "ORD-1" } });
    expect(JSON.stringify(result)).not.toContain("12345678900");
  });

  it("pays an existing cart item with a single checkout call and keeps only safe metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        purchase: { id: "purchase-1", status: "paid", orders: [{ id: "cart-shipment-1", status: "released" }] },
        address: "Rua confidencial, 1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new MelhorEnvioProvider().checkoutCart("cart-shipment-1", "seller-specific-token");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sandbox.melhorenvio.com.br/api/v2/me/shipment/checkout");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ orders: ["cart-shipment-1"] });
    expect(result).toEqual({
      externalShipmentId: "cart-shipment-1",
      status: "READY_TO_SHIP",
      providerMetadata: { purchaseId: "purchase-1", purchaseStatus: "paid" },
    });
    expect(JSON.stringify(result)).not.toContain("Rua confidencial");
  });

  it("sends the unit insurance value with the quantity and reads the quoted packages", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json([
        {
          id: 3,
          name: ".Package",
          custom_price: "30.10",
          company: { name: "Jadlog" },
          packages: [
            { dimensions: { height: 12, width: 20, length: 30 }, weight: "1.50", insurance_value: "300.00" },
            { dimensions: { height: 5, width: 11, length: 16 }, weight: "0.30", insurance_value: "100.00" },
          ],
        },
        { id: 4, name: "Sem pacotes", custom_price: "40.00", company: { name: "Jadlog" }, packages: [{}] },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await new MelhorEnvioProvider().quote(
      {
        fromPostalCode: "01001000",
        toPostalCode: "01310000",
        products: [
          {
            id: "SKU-1",
            widthInCm: 10,
            heightInCm: 5,
            lengthInCm: 20,
            weightInKg: 0.5,
            insuranceValueInCents: 10_000,
            quantity: 4,
          },
        ],
      },
      "seller-specific-token",
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.products[0]).toMatchObject({ insurance_value: 100, quantity: 4 });
    expect(quotes[0]?.packages).toEqual([
      { heightInCm: 12, widthInCm: 20, lengthInCm: 30, weightInKg: 1.5, insuranceValueInCents: 30_000 },
      { heightInCm: 5, widthInCm: 11, lengthInCm: 16, weightInKg: 0.3, insuranceValueInCents: 10_000 },
    ]);
    expect(quotes[1]?.packages).toBeUndefined();
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

  it.each([
    [
      "registrar a etiqueta no carrinho",
      (provider: MelhorEnvioProvider) =>
        provider.addToCart(
          {
            sellerOrderId: "seller-order-1",
            serviceCode: "1",
            from: {},
            to: {},
            products: [],
            volumes: [{ heightInCm: 1, widthInCm: 1, lengthInCm: 1, weightInKg: 1 }],
            insuranceValueInCents: 0,
          },
          "seller-specific-token",
        ),
    ],
    ["comprar a etiqueta", (provider: MelhorEnvioProvider) => provider.checkoutCart("cart-1", "seller-specific-token")],
    [
      "calcular o frete",
      (provider: MelhorEnvioProvider) =>
        provider.quote({ fromPostalCode: "01001000", toPostalCode: "01310000", products: [] }, "seller-specific-token"),
    ],
    ["atualizar o rastreio", (provider: MelhorEnvioProvider) => provider.track("external-1", "seller-specific-token")],
  ] as const)("uses an operation-specific message when the provider fails to %s", async (operation, call) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(Response.json({ message: "saldo insuficiente" }, { status: 422 })),
    );

    await expect(call(new MelhorEnvioProvider())).rejects.toMatchObject({
      message: `O Melhor Envio não conseguiu ${operation}.`,
      definitive: true,
    });
  });
});
