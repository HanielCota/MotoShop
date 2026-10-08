import "server-only";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
import { ShippingProviderRequestError } from "./shipping-provider-error";
import type {
  AddShipmentToCartInput,
  CartItemResult,
  ShippingPackage,
  ShippingProvider,
  ShippingQuote,
  ShippingQuoteInput,
  ShipmentGenerationResult,
  ShipmentResult,
  TrackingResult,
} from "@/shared/shipping/shipping-provider";

const DEFAULT_API_URL = "https://sandbox.melhorenvio.com.br";

export class MelhorEnvioProvider implements ShippingProvider {
  async quote(input: ShippingQuoteInput, accessToken: string): Promise<ShippingQuote[]> {
    this.assertToken(accessToken);
    const response = await this.request("/api/v2/me/shipment/calculate", {
      method: "POST",
      operation: "calcular o frete",
      accessToken,
      body: {
        from: { postal_code: input.fromPostalCode },
        to: { postal_code: input.toPostalCode },
        products: input.products.map((product) => ({
          id: product.id,
          width: product.widthInCm,
          height: product.heightInCm,
          length: product.lengthInCm,
          weight: product.weightInKg,
          // Valor UNITÁRIO: o Melhor Envio multiplica o `insurance_value` pela `quantity`.
          insurance_value: product.insuranceValueInCents / 100,
          quantity: product.quantity,
        })),
        options: { receipt: false, own_hand: false },
        ...(input.services?.length ? { services: input.services.join(",") } : {}),
      },
    });

    if (!Array.isArray(response)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O Melhor Envio retornou uma resposta de cotação inválida.",
        statusCode: 502,
      });
    }

    return response
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .filter((item) => !item.error)
      .filter((item) => typeof item.id === "number" || (typeof item.id === "string" && item.id.length > 0))
      .map((item) => {
        const estimatedDeliveryDays = toOptionalInteger(item.custom_delivery_time ?? item.delivery_time);
        const packages = readPackages(item.packages);
        return {
          provider: "MELHOR_ENVIO",
          serviceCode: String(item.id),
          carrier: readNestedString(item, ["company", "name"]) ?? "Transportadora",
          service: String(item.name ?? item.service ?? "Serviço"),
          priceInCents: toCents(item.custom_price ?? item.price),
          ...(estimatedDeliveryDays !== undefined ? { estimatedDeliveryDays } : {}),
          ...(packages ? { packages } : {}),
          raw: item,
        };
      })
      .filter((quote) => quote.priceInCents >= 0);
  }

  /**
   * Passo 1 da compra: insere o envio no carrinho do Melhor Envio. Não é idempotente no provedor
   * (cada chamada cria outro item), por isso o id retornado deve ser persistido antes do checkout.
   */
  async addToCart(input: AddShipmentToCartInput, accessToken: string): Promise<CartItemResult> {
    this.assertToken(accessToken);
    const service = Number(input.serviceCode);
    if (!Number.isInteger(service) || service <= 0) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "O serviço de frete do Melhor Envio é inválido.",
      });
    }
    if (input.volumes.length === 0) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "Informe ao menos um volume para registrar a etiqueta.",
      });
    }

    const cartPayload = await this.request("/api/v2/me/cart", {
      method: "POST",
      operation: "registrar a etiqueta no carrinho",
      accessToken,
      body: {
        service,
        from: input.from,
        to: input.to,
        products: input.products.map((product) => ({
          name: product.name ?? product.id,
          quantity: product.quantity,
          unitary_value: (product.unitaryValueInCents ?? product.insuranceValueInCents) / 100,
        })),
        volumes: input.volumes.map((volume) => ({
          height: volume.heightInCm,
          width: volume.widthInCm,
          length: volume.lengthInCm,
          weight: volume.weightInKg,
        })),
        options: {
          // "Deve conter o valor total de seguro do envio" (docs: inserir fretes no carrinho).
          insurance_value: input.insuranceValueInCents / 100,
          receipt: false,
          own_hand: false,
          reverse: false,
          ...(input.tags ? { tags: input.tags } : {}),
        },
      },
    });
    const cartItemId = readExternalId(cartPayload);
    if (!cartItemId) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O Melhor Envio não retornou o identificador da etiqueta no carrinho.",
      });
    }
    return {
      cartItemId,
      providerMetadata: toSafeProviderMetadata(toRecord(Array.isArray(cartPayload) ? cartPayload[0] : cartPayload), [
        "protocol",
        "status",
      ]),
    };
  }

  /** Passo 2 da compra: paga um item de carrinho existente. Novas tentativas reutilizam o mesmo id. */
  async checkoutCart(cartItemId: string, accessToken: string): Promise<ShipmentResult> {
    this.assertToken(accessToken);
    if (!cartItemId.trim()) {
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe o identificador da etiqueta." });
    }
    const checkoutPayload = await this.request("/api/v2/me/shipment/checkout", {
      method: "POST",
      operation: "comprar a etiqueta",
      accessToken,
      body: { orders: [cartItemId] },
    });
    const purchase = toRecord(toRecord(checkoutPayload).purchase);
    const checkoutResult = readSafeProviderString(checkoutPayload, "result");
    const purchaseId = readSafeProviderString(purchase, "id");
    const purchaseStatus = readSafeProviderString(purchase, "status");
    return {
      externalShipmentId: cartItemId,
      status: "READY_TO_SHIP",
      providerMetadata: {
        ...(checkoutResult ? { checkoutResult } : {}),
        ...(purchaseId ? { purchaseId } : {}),
        ...(purchaseStatus ? { purchaseStatus } : {}),
      },
    };
  }

  async generateShipment(externalShipmentId: string, accessToken: string): Promise<ShipmentGenerationResult> {
    this.assertToken(accessToken);
    const payload = await this.request("/api/v2/me/shipment/generate", {
      method: "POST",
      operation: "gerar a etiqueta",
      accessToken,
      body: { orders: [externalShipmentId] },
    });
    return { externalShipmentId, providerMetadata: toSafeProviderMetadata(payload, ["status", "result", "protocol"]) };
  }

  async getShipmentDetails(externalShipmentId: string, accessToken: string): Promise<Record<string, unknown>> {
    this.assertToken(accessToken);
    if (!externalShipmentId.trim()) {
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Informe o identificador do envio." });
    }
    const payload = await this.request(`/api/v2/me/orders/${encodeURIComponent(externalShipmentId)}`, {
      method: "GET",
      operation: "consultar o envio",
      accessToken,
    });
    const details = toRecord(payload);
    const returnedId = details.id ?? details.order_id;
    if (String(returnedId ?? "") !== externalShipmentId) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O Melhor Envio não confirmou esse identificador de etiqueta.",
        statusCode: 409,
      });
    }
    return details;
  }

  async track(externalShipmentId: string, accessToken: string): Promise<TrackingResult> {
    this.assertToken(accessToken);
    const payload = await this.request("/api/v2/me/shipment/tracking", {
      method: "POST",
      operation: "atualizar o rastreio",
      accessToken,
      body: { orders: [externalShipmentId] },
    });
    const tracking = Array.isArray(payload) ? payload[0] : payload;
    const data = toRecord(tracking);
    return {
      status: String(data.status ?? "UNKNOWN"),
      ...(typeof data.tracking === "string" ? { trackingCode: data.tracking } : {}),
      ...(typeof data.tracking_code === "string" ? { trackingCode: data.tracking_code } : {}),
      ...(typeof data.tracking_url === "string" ? { trackingUrl: data.tracking_url } : {}),
      providerMetadata: toSafeProviderMetadata(data, ["status"]),
    };
  }

  private assertToken(accessToken: string): void {
    if (!accessToken.trim()) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "Conecte a conta do Melhor Envio da loja para consultar o frete.",
        statusCode: 503,
      });
    }
  }

  private async request(
    path: string,
    input: { method: "GET" | "POST"; operation: string; body?: Record<string, unknown>; accessToken: string },
  ): Promise<unknown> {
    const response = await fetch(`${env.MELHOR_ENVIO_API_URL ?? DEFAULT_API_URL}${path}`, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": env.MELHOR_ENVIO_USER_AGENT ?? "O Moto Shop (suporte@motoshopbrasil.com.br)",
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ShippingProviderRequestError({
        message: `O Melhor Envio não conseguiu ${input.operation}.`,
        providerStatus: response.status,
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

/**
 * Lê os pacotes que o Melhor Envio calculou para um serviço (`packages` da cotação). Retorna
 * `undefined` se algum pacote vier sem medidas válidas, para a compra nunca usar volumes parciais.
 */
function readPackages(value: unknown): ShippingPackage[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const packages: ShippingPackage[] = [];
  for (const entry of value) {
    const record = toRecord(entry);
    const dimensions = toRecord(record.dimensions);
    const heightInCm = toPositiveNumber(dimensions.height);
    const widthInCm = toPositiveNumber(dimensions.width);
    const lengthInCm = toPositiveNumber(dimensions.length);
    const weightInKg = toPositiveNumber(record.weight);
    if (!heightInCm || !widthInCm || !lengthInCm || !weightInKg) return undefined;
    const insuranceValueInCents = toCents(record.insurance_value);
    packages.push({
      heightInCm,
      widthInCm,
      lengthInCm,
      weightInKg,
      ...(insuranceValueInCents >= 0 ? { insuranceValueInCents } : {}),
    });
  }
  return packages;
}

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readSafeProviderString(value: unknown, key: string): string | undefined {
  const candidate = toRecord(value)[key];
  return typeof candidate === "string" && candidate.length <= 100 ? candidate : undefined;
}

function toSafeProviderMetadata(value: unknown, keys: readonly string[]): Record<string, string | number | boolean> {
  const record = toRecord(value);
  const safe: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length <= 100) safe[key] = candidate;
    else if (typeof candidate === "number" && Number.isFinite(candidate)) safe[key] = candidate;
    else if (typeof candidate === "boolean") safe[key] = candidate;
  }
  return safe;
}

function toCents(value: unknown): number {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return -1;
  const amount = typeof value === "number" ? value : Number(value);
  const cents = Math.round(amount * 100);
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : -1;
}

function toOptionalInteger(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return undefined;
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
