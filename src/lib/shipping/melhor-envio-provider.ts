import "server-only";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
import type {
  CreateShipmentInput,
  ShippingProvider,
  ShippingQuote,
  ShippingQuoteInput,
  ShipmentGenerationResult,
  ShipmentResult,
  TrackingResult,
} from "@/shared/shipping/shipping-provider";

const DEFAULT_API_URL = "https://sandbox.melhorenvio.com.br";

export class MelhorEnvioProvider implements ShippingProvider {
  async quote(input: ShippingQuoteInput): Promise<ShippingQuote[]> {
    this.assertConfigured();
    const response = await this.request("/api/v2/me/shipment/calculate", {
      method: "POST",
      body: {
        from: { postal_code: input.fromPostalCode },
        to: { postal_code: input.toPostalCode },
        products: input.products.map((product) => ({
          id: product.id,
          width: product.widthInCm,
          height: product.heightInCm,
          length: product.lengthInCm,
          weight: product.weightInKg,
          insurance_value: product.insuranceValueInCents / 100,
          quantity: product.quantity,
        })),
        options: { receipt: false, own_hand: false },
        ...(input.services?.length ? { services: input.services.join(",") } : {}),
      },
    });

    const payload = Array.isArray(response) ? response : [];
    return payload
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .filter((item) => !item.error)
      .map((item) => {
        const estimatedDeliveryDays = toOptionalInteger(item.custom_delivery_time ?? item.delivery_time);
        return {
          provider: "MELHOR_ENVIO",
          serviceCode: String(item.id ?? item.service ?? "unknown"),
          carrier: readNestedString(item, ["company", "name"]) ?? "Transportadora",
          service: String(item.name ?? item.service ?? "Serviço"),
          priceInCents: toCents(item.custom_price ?? item.price),
          ...(estimatedDeliveryDays !== undefined ? { estimatedDeliveryDays } : {}),
          raw: item,
        };
      })
      .filter((quote) => quote.priceInCents >= 0);
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    this.assertConfigured();
    const service = Number(input.serviceCode);
    if (!Number.isInteger(service) || service <= 0) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "O serviço de frete do Melhor Envio é inválido.",
      });
    }

    const cartPayload = await this.request("/api/v2/me/cart", {
      method: "POST",
      body: {
        service,
        from: input.from,
        to: input.to,
        products: input.products.map((product) => ({
          name: product.name ?? product.id,
          quantity: product.quantity,
          unitary_value:
            (product.unitaryValueInCents ?? product.insuranceValueInCents / product.quantity) / 100,
        })),
        volumes: input.volumes.map((volume) => ({
          height: volume.heightInCm,
          width: volume.widthInCm,
          length: volume.lengthInCm,
          weight: volume.weightInKg,
        })),
        options: {
          insurance_value: input.insuranceValueInCents / 100,
          receipt: false,
          own_hand: false,
          reverse: false,
        },
        ...(input.tags ? { tags: input.tags } : {}),
      },
    });
    const externalShipmentId = readExternalId(cartPayload);
    if (!externalShipmentId) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O Melhor Envio não retornou o identificador da etiqueta.",
      });
    }

    const checkoutPayload = await this.request("/api/v2/me/shipment/checkout", {
      method: "POST",
      body: { orders: [externalShipmentId] },
    });
    return {
      externalShipmentId,
      status: "READY_TO_SHIP",
      providerMetadata: { cart: cartPayload, checkout: checkoutPayload },
    };
  }

  async generateShipment(externalShipmentId: string): Promise<ShipmentGenerationResult> {
    this.assertConfigured();
    const payload = await this.request("/api/v2/me/shipment/generate", {
      method: "POST",
      body: { orders: [externalShipmentId] },
    });
    return { externalShipmentId, providerMetadata: toRecord(payload) };
  }

  async track(externalShipmentId: string): Promise<TrackingResult> {
    this.assertConfigured();
    const payload = await this.request("/api/v2/me/shipment/tracking", {
      method: "POST",
      body: { orders: [externalShipmentId] },
    });
    const tracking = Array.isArray(payload) ? payload[0] : payload;
    const data = toRecord(tracking);
    return {
      status: String(data.status ?? "UNKNOWN"),
      ...(typeof data.tracking === "string" ? { trackingCode: data.tracking } : {}),
      ...(typeof data.tracking_code === "string" ? { trackingCode: data.tracking_code } : {}),
      ...(typeof data.tracking_url === "string" ? { trackingUrl: data.tracking_url } : {}),
      providerMetadata: data,
    };
  }

  private assertConfigured(): void {
    if (!env.MELHOR_ENVIO_TOKEN) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "Melhor Envio ainda não está configurado no ambiente da Moto Shop.",
        statusCode: 503,
      });
    }
  }

  private async request(
    path: string,
    input: { method: "GET" | "POST"; body?: Record<string, unknown> },
  ): Promise<unknown> {
    const response = await fetch(`${env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL}${path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${env.MELHOR_ENVIO_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": env.MELHOR_ENVIO_USER_AGENT ?? "Moto Shop (suporte@example.com)",
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O Melhor Envio não conseguiu calcular o frete.",
        statusCode: response.status >= 500 ? 502 : 409,
        cause: payload,
      });
    }
    return payload;
  }
}

function readExternalId(payload: unknown): string | undefined {
  const data = toRecord(Array.isArray(payload) ? payload[0] : payload);
  const id = data.id ?? data.order_id;
  return typeof id === "string" || typeof id === "number" ? String(id) : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function toCents(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : -1;
}

function toOptionalInteger(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function readNestedString(value: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.length > 0 ? current : undefined;
}

export const melhorEnvioProvider = new MelhorEnvioProvider();
