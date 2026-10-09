import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { melhorEnvioProvider } from "@/lib/shipping/melhor-envio-provider";
import { isDefinitiveProviderRejection } from "@/lib/shipping/shipping-provider-error";
import {
  canRunShipmentOperation,
  mapProviderShipmentStatus,
  resolveShipmentStatus,
} from "@/modules/orders/domain/fulfillment-status";
import { syncFulfillmentStatuses } from "@/modules/orders/application/sync-fulfillment-status";
import { ApplicationError } from "@/shared/errors/application-error";
import { getSellerMelhorEnvioAccessTokenWithScopes } from "@/modules/shipping/infrastructure/melhor-envio-oauth";
import {
  buildShipmentData,
  carrierAcceptsMultipleVolumes,
  volumesFromQuotedPackages,
} from "@/modules/shipping/domain/shipment-payload";
import {
  getPurchaseCartDiscardReason,
  readPurchaseCart,
  withPurchaseCart,
  withoutPurchaseCart,
} from "@/modules/shipping/domain/purchase-cart";
import type { ShippingProduct, ShippingVolume } from "@/shared/shipping/shipping-provider";

import {
  STALE_GENERATION_MESSAGE,
  STALE_PURCHASE_MESSAGE,
  assertShipmentOperationAllowed,
  hasLabelCancellationFlag,
  lockSellerOrderStatus,
  readProviderMetadata,
  withLabelCancellationFlag,
} from "./shipment-operation-guard";

export type FulfillSellerOrderInput = {
  sellerOrderId: string;
  sellerId: string;
  actorUserId: string;
  tags?: Array<{ tag: string; url?: string }>;
};

export async function purchaseSellerOrderShipment(input: FulfillSellerOrderInput) {
  const sellerOrder = await getSellerOrderForFulfillment(input.sellerOrderId, input.sellerId);
  assertIntegratedShipment(sellerOrder.shipment?.provider);
  assertShipmentOperationAllowed(sellerOrder.status, "PURCHASE");
  if (!sellerOrder.shipment?.serviceCode) {
    throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "O serviço de frete não foi salvo no pedido." });
  }
  const shipment = sellerOrder.shipment;
  const serviceCode = sellerOrder.shipment.serviceCode;
  const accessToken = await requireSellerShippingToken(sellerOrder.sellerId, ["cart-write", "shipping-checkout"]);
  if (shipment.status !== "CANCELLED" && shipment.externalShipmentId) return shipment;

  let metadata: unknown =
    shipment.status === "CANCELLED"
      ? await resetCancelledShipmentForRepurchase(input, shipment.id)
      : shipment.providerMetadata;
  if (shipment.purchaseState) {
    throw new ApplicationError({
      code: "CONFLICT",
      message:
        shipment.purchaseState === "IN_PROGRESS"
          ? "A compra da etiqueta já foi iniciada. Aguarde ou solicite a conferência antes de tentar novamente."
          : "O resultado da compra da etiqueta é incerto. Confira os envios no Melhor Envio antes de tentar novamente.",
      statusCode: 409,
    });
  }

  const shipmentData = buildShipmentData(sellerOrder);

  // Item de carrinho criado por uma tentativa anterior cujo pagamento foi recusado de forma
  // definitiva: a nova tentativa paga o mesmo item em vez de inserir outro no carrinho.
  let pendingCart = readPurchaseCart(metadata);
  if (pendingCart) {
    const discardReason = getPurchaseCartDiscardReason(pendingCart, serviceCode);
    if (discardReason) {
      metadata = withoutPurchaseCart(metadata, { reason: discardReason });
      const discarded = await db.shipment.updateMany({
        where: { id: shipment.id, externalShipmentId: null, purchaseState: null },
        data: { providerMetadata: metadata as Prisma.InputJsonValue },
      });
      if (discarded.count !== 1) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "A compra da etiqueta já está em andamento ou precisa de conferência manual.",
          statusCode: 409,
        });
      }
      logger.warn(
        {
          event: "shipment.purchase_cart_discarded",
          sellerOrderId: input.sellerOrderId,
          cartItemId: pendingCart.cartItemId,
          reason: discardReason,
        },
        "Stored Melhor Envio cart item can no longer be paid; a new one will be created",
      );
      pendingCart = null;
    }
  }

  // Cotação somente leitura, fora de transação, para obter os pacotes calculados pelo provedor.
  const quotedVolumes = pendingCart
    ? null
    : await quotePurchaseVolumes({
        sellerOrderId: input.sellerOrderId,
        fromPostalCode: sellerOrder.store?.originPostalCode ?? "",
        toPostalCode: sellerOrder.order.shippingAddress?.postalCode ?? "",
        products: shipmentData.products,
        serviceCode,
        contractedCarrier: shipment.carrier,
        contractedPriceInCents: shipment.priceInCents,
        accessToken,
      });

  const claim = await db.shipment.updateMany({
    where: { id: shipment.id, externalShipmentId: null, purchaseState: null },
    data: { purchaseState: "IN_PROGRESS", purchaseError: null },
  });
  if (claim.count !== 1) {
    const current = await db.shipment.findUnique({ where: { id: shipment.id } });
    if (current?.externalShipmentId) return current;
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A compra da etiqueta já está em andamento ou precisa de conferência manual.",
      statusCode: 409,
    });
  }

  // Passo 1: inserir no carrinho (não idempotente no provedor) e persistir o id imediatamente.
  const cartStep = pendingCart
    ? { cartItemId: pendingCart.cartItemId, metadata }
    : await addPurchaseCartItem({
        sellerOrderId: input.sellerOrderId,
        shipmentId: shipment.id,
        orderNumber: sellerOrder.order.orderNumber,
        serviceCode,
        shipmentData,
        quotedVolumes,
        tags: input.tags,
        accessToken,
        metadata,
      });
  const cartItemId = cartStep.cartItemId;
  metadata = cartStep.metadata;

  // Passo 2: pagar o item de carrinho persistido.
  let result: Awaited<ReturnType<typeof melhorEnvioProvider.checkoutCart>>;
  try {
    result = await melhorEnvioProvider.checkoutCart(cartItemId, accessToken);
  } catch (error) {
    await recordPurchaseFailure({
      shipmentId: shipment.id,
      sellerOrderId: input.sellerOrderId,
      error,
      metadata,
      cartItemId,
    });
    throw error;
  }
  const purchasedMetadata: Record<string, unknown> = {
    ...withoutPurchaseCart(metadata),
    ...result.providerMetadata,
  };

  // A chamada externa acontece fora da transação (AGENTS.md §36). O pedido pode ter sido
  // cancelado enquanto isso: revalida o status com o registro travado antes de avançar o envio.
  const outcome = await db.$transaction(async (tx) => {
    const currentStatus = await lockSellerOrderStatus(tx, input.sellerOrderId);
    if (!canRunShipmentOperation(currentStatus, "PURCHASE")) {
      // A etiqueta já foi paga no provedor: guarda o id externo para estorno/cancelamento,
      // sem marcar o envio como pronto nem alterar o status do pedido. Se o cancelamento já foi
      // concluído, sinaliza a etiqueta para a fila de conferência do Admin.
      const updatedShipment = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          externalShipmentId: result.externalShipmentId,
          purchaseState: null,
          purchaseError: STALE_PURCHASE_MESSAGE,
          ...(currentStatus === "CANCELLED"
            ? {
                status: "CANCELLED" as const,
                providerMetadata: withLabelCancellationFlag(purchasedMetadata, "PURCHASED_AFTER_CANCELLATION"),
              }
            : { providerMetadata: purchasedMetadata as Prisma.InputJsonValue }),
        },
      });
      return { shipment: updatedShipment, staleStatus: currentStatus };
    }
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        externalShipmentId: result.externalShipmentId,
        status: "READY_TO_SHIP",
        purchaseState: null,
        purchaseError: null,
        providerMetadata: purchasedMetadata as Prisma.InputJsonValue,
      },
    });
    await syncFulfillmentStatuses(tx, input.sellerOrderId, "READY_TO_SHIP", input.actorUserId);
    return { shipment: updatedShipment, staleStatus: null };
  });
  if (outcome.staleStatus) {
    logger.error(
      {
        event: "shipment.purchased_for_inactive_order",
        sellerOrderId: input.sellerOrderId,
        status: outcome.staleStatus,
      },
      "Shipment was purchased after the seller order left the fulfillment flow; manual label cancellation required",
    );
    throw new ApplicationError({ code: "CONFLICT", message: STALE_PURCHASE_MESSAGE, statusCode: 409 });
  }
  return outcome.shipment;
}

async function addPurchaseCartItem(input: {
  sellerOrderId: string;
  shipmentId: string;
  orderNumber: string;
  serviceCode: string;
  shipmentData: ReturnType<typeof buildShipmentData>;
  quotedVolumes: { volumes: ShippingVolume[]; quotedPriceInCents: number } | null;
  tags: FulfillSellerOrderInput["tags"];
  accessToken: string;
  metadata: unknown;
}) {
  if (!input.quotedVolumes) throw new Error("Melhor Envio volumes must be quoted before creating a cart item");
  const volumes = input.quotedVolumes.volumes;
  let metadata = input.metadata;
  let cart: Awaited<ReturnType<typeof melhorEnvioProvider.addToCart>>;
  try {
    cart = await melhorEnvioProvider.addToCart(
      {
        sellerOrderId: input.sellerOrderId,
        serviceCode: input.serviceCode,
        ...input.shipmentData,
        volumes,
        ...(input.tags ? { tags: input.tags } : { tags: [{ tag: input.orderNumber }] }),
      },
      input.accessToken,
    );
  } catch (error) {
    await recordPurchaseFailure({ shipmentId: input.shipmentId, sellerOrderId: input.sellerOrderId, error, metadata });
    throw error;
  }
  const cartItemId = cart.cartItemId;
  metadata = withPurchaseCart(metadata, {
    step: "CART_CREATED",
    cartItemId,
    serviceCode: input.serviceCode,
    createdAt: new Date().toISOString(),
    volumeCount: volumes.length,
    quotedPriceInCents: input.quotedVolumes.quotedPriceInCents,
  });
  const saved = await db.shipment.updateMany({
    where: { id: input.shipmentId, purchaseState: "IN_PROGRESS", externalShipmentId: null },
    data: { providerMetadata: metadata as Prisma.InputJsonValue },
  });
  if (saved.count !== 1) {
    logger.error(
      { event: "shipment.purchase_cart_not_persisted", sellerOrderId: input.sellerOrderId, cartItemId },
      "Melhor Envio cart item was created but the shipment claim changed; manual reconciliation required",
    );
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A compra da etiqueta precisa de conferência manual antes de uma nova tentativa.",
      statusCode: 409,
    });
  }
  return { cartItemId, metadata };
}

/**
 * Cota novamente o serviço contratado com os mesmos produtos (medidas unitárias, valor unitário e
 * quantidade) enviados na cotação do checkout e devolve os pacotes calculados pelo Melhor Envio,
 * que a documentação manda usar como `volumes` ao inserir no carrinho.
 */
async function quotePurchaseVolumes(input: {
  sellerOrderId: string;
  fromPostalCode: string;
  toPostalCode: string;
  products: ShippingProduct[];
  serviceCode: string;
  contractedCarrier: string;
  contractedPriceInCents: number;
  accessToken: string;
}): Promise<{ volumes: ShippingVolume[]; quotedPriceInCents: number }> {
  const quotes = await melhorEnvioProvider.quote(
    {
      fromPostalCode: input.fromPostalCode,
      toPostalCode: input.toPostalCode,
      products: input.products,
      services: [input.serviceCode],
    },
    input.accessToken,
  );
  const quote = quotes.find((candidate) => candidate.serviceCode === input.serviceCode);
  if (!quote) {
    throw new ApplicationError({
      code: "CONFLICT",
      message:
        "O Melhor Envio não ofereceu o serviço contratado para este envio na nova cotação. Tente novamente mais tarde.",
      statusCode: 409,
    });
  }
  if (!quote.packages?.length) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O Melhor Envio não informou os volumes deste envio na cotação. Tente novamente mais tarde.",
      statusCode: 502,
    });
  }
  if (
    quote.packages.length > 1 &&
    !(carrierAcceptsMultipleVolumes(quote.carrier) && carrierAcceptsMultipleVolumes(input.contractedCarrier))
  ) {
    throw new ApplicationError({
      code: "CONFLICT",
      message: `Este envio precisa de ${quote.packages.length} volumes e a transportadora aceita apenas um volume por etiqueta. Compre as etiquetas diretamente no Melhor Envio.`,
      statusCode: 409,
    });
  }
  if (quote.priceInCents !== input.contractedPriceInCents) {
    logger.warn(
      {
        event: "shipment.purchase_quote_price_changed",
        sellerOrderId: input.sellerOrderId,
        contractedPriceInCents: input.contractedPriceInCents,
        quotedPriceInCents: quote.priceInCents,
      },
      "Label quote differs from the price charged at checkout",
    );
  }
  return { volumes: volumesFromQuotedPackages(quote.packages), quotedPriceInCents: quote.priceInCents };
}

/**
 * Recusa explícita (4xx exceto 408/409/429): nada foi cobrado; libera nova tentativa mantendo o item
 * de carrinho já criado. Demais falhas deixam o resultado incerto e bloqueiam novas tentativas.
 */
async function recordPurchaseFailure(input: {
  shipmentId: string;
  sellerOrderId: string;
  error: unknown;
  metadata: unknown;
  cartItemId?: string;
}) {
  const where = { id: input.shipmentId, purchaseState: "IN_PROGRESS" as const, externalShipmentId: null };
  const step = input.cartItemId ? "CHECKOUT" : "CART";
  if (isDefinitiveProviderRejection(input.error)) {
    const cartMissing = step === "CHECKOUT" && input.error.providerStatus === 404;
    await db.shipment.updateMany({
      where,
      data: {
        purchaseState: null,
        purchaseError: input.error.message,
        ...(cartMissing
          ? {
              providerMetadata: withoutPurchaseCart(input.metadata, {
                reason: "NOT_FOUND_AT_PROVIDER",
              }) as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
    logger.warn(
      {
        event: "shipment.purchase_rejected",
        sellerOrderId: input.sellerOrderId,
        step,
        providerStatus: input.error.providerStatus,
        ...(input.cartItemId ? { cartItemId: input.cartItemId } : {}),
      },
      "Shipping provider rejected the label purchase; retry released",
    );
    return;
  }
  await db.shipment.updateMany({
    where,
    data: {
      purchaseState: "OUTCOME_UNKNOWN",
      purchaseError: input.cartItemId
        ? `O provedor não confirmou o pagamento da etiqueta ${input.cartItemId}; confira antes de uma nova tentativa.`
        : "O provedor não confirmou o resultado; confira antes de uma nova tentativa.",
    },
  });
  logger.error(
    {
      event: "shipment.purchase_outcome_unknown",
      sellerOrderId: input.sellerOrderId,
      step,
      ...(input.cartItemId ? { cartItemId: input.cartItemId } : {}),
      errorName: input.error instanceof Error ? input.error.name : "UnknownError",
    },
    "Shipment purchase outcome is unknown; automatic retry is blocked",
  );
}

/**
 * Uma etiqueta cancelada no Melhor Envio não pode ser reaproveitada: arquiva o id externo no
 * histórico do `providerMetadata` e devolve o envio a `PENDING` para permitir nova compra.
 */
async function resetCancelledShipmentForRepurchase(
  input: FulfillSellerOrderInput,
  shipmentId: string,
): Promise<Record<string, unknown>> {
  return db.$transaction(async (tx) => {
    const status = await lockSellerOrderStatus(tx, input.sellerOrderId);
    assertShipmentOperationAllowed(status, "PURCHASE");
    await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipmentId} FOR UPDATE`;
    const current = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        status: true,
        purchaseState: true,
        externalShipmentId: true,
        generationState: true,
        trackingCode: true,
        providerMetadata: true,
      },
    });
    if (!current || current.status !== "CANCELLED" || current.purchaseState) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O envio foi atualizado por outra operação. Recarregue o pedido antes de tentar novamente.",
        statusCode: 409,
      });
    }
    if (hasLabelCancellationFlag(current.providerMetadata)) {
      throw new ApplicationError({
        code: "CONFLICT",
        message: "A etiqueta anterior ainda precisa ter o cancelamento conferido no Melhor Envio.",
        statusCode: 409,
      });
    }
    const metadata = readProviderMetadata(current.providerMetadata);
    const previousLabels = Array.isArray(metadata.previousLabels) ? metadata.previousLabels : [];
    const archivedLabel = {
      externalShipmentId: current.externalShipmentId,
      generationState: current.generationState,
      trackingCode: current.trackingCode,
      archivedAt: new Date().toISOString(),
    };
    const resetMetadata = { previousLabels: [...previousLabels, archivedLabel] };
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: "PENDING",
        externalShipmentId: null,
        purchaseState: null,
        purchaseError: null,
        generationState: null,
        generationError: null,
        generatedAt: null,
        trackingCode: null,
        trackingUrl: null,
        shippedAt: null,
        deliveredAt: null,
        providerMetadata: resetMetadata as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "SHIPMENT_RESET_FOR_REPURCHASE",
        entityType: "SHIPMENT",
        entityId: shipmentId,
        actorUserId: input.actorUserId,
        metadata: { sellerOrderId: input.sellerOrderId, previousExternalShipmentId: current.externalShipmentId },
      },
    });
    return resetMetadata;
  });
}

export async function generateSellerOrderShipment(sellerOrderId: string, sellerId: string, actorUserId: string) {
  const { shipment, status } = await getShipment(sellerOrderId, sellerId);
  assertIntegratedShipment(shipment.provider);
  assertShipmentOperationAllowed(status, "GENERATE");
  if (!shipment.externalShipmentId)
    throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta ainda não foi comprada." });
  if (shipment.status === "CANCELLED")
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A etiqueta foi cancelada. Compre uma nova etiqueta antes de gerar.",
      statusCode: 409,
    });
  if (shipment.generationState === "GENERATED") return shipment;
  if (shipment.generationState) {
    throw new ApplicationError({
      code: "CONFLICT",
      message:
        shipment.generationState === "IN_PROGRESS"
          ? "A geração da etiqueta já foi iniciada. Aguarde antes de tentar novamente."
          : "O resultado da geração é incerto. Peça a conferência administrativa antes de tentar novamente.",
      statusCode: 409,
    });
  }

  const accessToken = await requireSellerShippingToken(sellerId, ["shipping-generate"]);
  const claim = await db.shipment.updateMany({
    where: { id: shipment.id, externalShipmentId: shipment.externalShipmentId, generationState: null },
    data: { generationState: "IN_PROGRESS", generationError: null },
  });
  if (claim.count !== 1) {
    const current = await db.shipment.findUnique({ where: { id: shipment.id } });
    if (current?.generationState === "GENERATED") return current;
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A geração da etiqueta já está em andamento ou precisa de conferência administrativa.",
      statusCode: 409,
    });
  }

  let result: Awaited<ReturnType<typeof melhorEnvioProvider.generateShipment>>;
  try {
    result = await melhorEnvioProvider.generateShipment(shipment.externalShipmentId, accessToken);
  } catch (error) {
    if (isDefinitiveProviderRejection(error)) {
      await db.shipment.updateMany({
        where: { id: shipment.id, generationState: "IN_PROGRESS" },
        data: { generationState: null, generationError: error.message },
      });
      logger.warn(
        { event: "shipment.generation_rejected", sellerOrderId, providerStatus: error.providerStatus },
        "Shipping provider rejected the label generation; retry released",
      );
      throw error;
    }
    await db.shipment.updateMany({
      where: { id: shipment.id, generationState: "IN_PROGRESS" },
      data: {
        generationState: "OUTCOME_UNKNOWN",
        generationError: "O provedor não confirmou a geração; confira antes de tentar novamente.",
      },
    });
    logger.error(
      {
        event: "shipment.generation_outcome_unknown",
        sellerOrderId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Shipment generation outcome is unknown; automatic retry is blocked",
    );
    throw error;
  }
  const outcome = await db.$transaction(async (tx) => {
    const currentStatus = await lockSellerOrderStatus(tx, sellerOrderId);
    if (!canRunShipmentOperation(currentStatus, "GENERATE")) {
      const updatedShipment = await tx.shipment.update({
        where: { id: shipment.id, generationState: "IN_PROGRESS" },
        data: {
          generationState: "GENERATED",
          generatedAt: new Date(),
          generationError: STALE_GENERATION_MESSAGE,
          ...(currentStatus === "CANCELLED"
            ? {
                status: "CANCELLED" as const,
                providerMetadata: withLabelCancellationFlag(result.providerMetadata, "GENERATED_AFTER_CANCELLATION"),
              }
            : { providerMetadata: result.providerMetadata as Prisma.InputJsonValue }),
        },
      });
      return { updatedShipment, staleStatus: currentStatus };
    }
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id, generationState: "IN_PROGRESS" },
      data: {
        status: "READY_TO_SHIP",
        generationState: "GENERATED",
        generatedAt: new Date(),
        generationError: null,
        providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
      },
    });
    await syncFulfillmentStatuses(tx, sellerOrderId, "READY_TO_SHIP", actorUserId);
    return { updatedShipment, staleStatus: null };
  });
  if (outcome.staleStatus) {
    logger.error(
      { event: "shipment.generated_for_inactive_order", sellerOrderId, status: outcome.staleStatus },
      "Shipment label was generated after the seller order left the fulfillment flow",
    );
    throw new ApplicationError({ code: "CONFLICT", message: STALE_GENERATION_MESSAGE, statusCode: 409 });
  }
  return outcome.updatedShipment;
}

export async function refreshSellerOrderTracking(sellerOrderId: string, sellerId: string, actorUserId: string) {
  const { shipment, status: sellerOrderStatus } = await getShipment(sellerOrderId, sellerId);
  assertIntegratedShipment(shipment.provider);
  assertShipmentOperationAllowed(sellerOrderStatus, "TRACK");
  if (!shipment.externalShipmentId)
    throw new ApplicationError({ code: "CONFLICT", message: "A etiqueta ainda não foi comprada." });

  const accessToken = await requireSellerShippingToken(sellerId, ["shipping-tracking"]);
  const result = await melhorEnvioProvider.track(shipment.externalShipmentId, accessToken);
  const reportedStatus = mapProviderShipmentStatus(result.status);
  if (!reportedStatus) {
    logger.warn(
      { event: "shipment.tracking_unknown_status", sellerOrderId, providerStatus: result.status },
      "Unknown shipping provider status; keeping the current shipment status",
    );
  }
  const updatedShipment = await db.$transaction(async (tx) => {
    const currentSellerOrderStatus = await lockSellerOrderStatus(tx, sellerOrderId);
    assertShipmentOperationAllowed(currentSellerOrderStatus, "TRACK");
    await tx.$queryRaw`SELECT id FROM "shipments" WHERE id = ${shipment.id} FOR UPDATE`;
    const currentShipment = await tx.shipment.findUnique({
      where: { id: shipment.id },
      select: { status: true, shippedAt: true, deliveredAt: true },
    });
    if (!currentShipment)
      throw new ApplicationError({ code: "NOT_FOUND", message: "Envio do lojista não encontrado." });
    const status = resolveShipmentStatus(currentShipment.status, reportedStatus);
    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        ...(result.trackingCode ? { trackingCode: result.trackingCode } : {}),
        ...(result.trackingUrl ? { trackingUrl: result.trackingUrl } : {}),
        providerMetadata: result.providerMetadata as Prisma.InputJsonValue,
        ...(status === "SHIPPED" || status === "IN_TRANSIT"
          ? { shippedAt: currentShipment.shippedAt ?? new Date() }
          : {}),
        ...(status === "DELIVERED" ? { deliveredAt: currentShipment.deliveredAt ?? new Date() } : {}),
      },
    });
    await syncFulfillmentStatuses(tx, sellerOrderId, status, actorUserId);
    return updatedShipment;
  });
  return updatedShipment;
}

async function getSellerOrderForFulfillment(sellerOrderId: string, sellerId: string) {
  const sellerOrder = await db.sellerOrder.findFirst({
    where: { id: sellerOrderId, sellerId },
    include: {
      shipment: true,
      seller: true,
      store: true,
      order: { include: { shippingAddress: true } },
      items: true,
    },
  });
  if (!sellerOrder) throw new ApplicationError({ code: "NOT_FOUND", message: "Pedido do lojista não encontrado." });
  return sellerOrder;
}

async function getShipment(sellerOrderId: string, sellerId: string) {
  const sellerOrder = await db.sellerOrder.findFirst({
    where: { id: sellerOrderId, sellerId },
    select: { status: true, shipment: true },
  });
  if (!sellerOrder?.shipment)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Envio do lojista não encontrado." });
  return { shipment: sellerOrder.shipment, status: sellerOrder.status };
}

async function requireSellerShippingToken(sellerId: string, requiredScopes: readonly string[]): Promise<string> {
  const accessToken = await getSellerMelhorEnvioAccessTokenWithScopes(sellerId, requiredScopes);
  if (!accessToken)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Conecte a conta do Melhor Envio da loja para gerenciar este envio.",
      statusCode: 409,
    });
  return accessToken;
}

function assertIntegratedShipment(provider: string | undefined) {
  if (provider !== "MELHOR_ENVIO")
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Use a atualização manual para entregas próprias da loja.",
    });
}
