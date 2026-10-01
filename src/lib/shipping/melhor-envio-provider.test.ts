import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  env: {
    MELHOR_ENVIO_TOKEN: "sandbox-token",
    MELHOR_ENVIO_API_URL: "https://sandbox.melhorenvio.com.br",
    MELHOR_ENVIO_USER_AGENT: "O Moto Shop (suporte@example.com)",
  },
}));

import { MelhorEnvioProvider } from "./melhor-envio-provider";

afterEach(() => vi.unstubAllGlobals());

describe("MelhorEnvioProvider shipment reconciliation", () => {
  it("places the platform order tag under options as required by the provider API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "cart-shipment-1" }))
      .mockResolvedValueOnce(Response.json({ result: "paid" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MelhorEnvioProvider();

    await provider.createShipment({
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
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.options.tags).toEqual([{ tag: "MS-202610-0001" }]);
    expect(requestBody.tags).toBeUndefined();
  });

  it("reads shipment details from the authenticated account and checks the returned ID", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id: "external-1", options: { tags: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new MelhorEnvioProvider();

    await expect(provider.getShipmentDetails("external-1")).resolves.toMatchObject({ id: "external-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.melhorenvio.com.br/api/v2/me/orders/external-1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects a provider response with a mismatched shipment ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ id: "other-id" })));
    const provider = new MelhorEnvioProvider();

    await expect(provider.getShipmentDetails("external-1")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
