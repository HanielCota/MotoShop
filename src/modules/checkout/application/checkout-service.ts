import "server-only";

import { createHmac } from "node:crypto";
import { env } from "@/config/env";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { mercadoPagoProvider } from "@/lib/payment/mercado-pago-provider";
import type { CartIdentity } from "@/modules/cart/infrastructure/cart-access";
import { hashGuestToken } from "@/modules/cart/infrastructure/cart-access";
import { findActiveCoupon } from "@/modules/coupons/application/validate-coupon-for-customer";
import { isSellerFundedCampaign } from "@/modules/coupons/domain/coupon-kind";
import { listActiveCouponParticipantSellerIds } from "@/modules/coupons/queries/coupon-participation";
import { sumMoneyInCents } from "@/modules/orders/domain/money";
import {
  applyPaymentOutcome,
  type ApplyPaymentOutcomeInput,
  type PendingOrderPaymentOutcome,
} from "@/modules/payments/application/apply-payment-outcome";
import {
  assertPaymentCanHandleSellers,
  assertPaymentConfigured,
} from "@/modules/payments/application/assert-payment-ready";
import {
  rejectedPaymentRequestMetadata,
  sentPaymentRequestMetadata,
} from "@/modules/payments/domain/payment-request-state";
import { ApplicationError } from "@/shared/errors/application-error";
import type { PaymentProvider } from "@/shared/payment/payment-provider";
import { PaymentProviderError } from "@/shared/payment/payment-provider-error";

import { createOrderNumber } from "../domain/order-number";
import { couponCustomerOf } from "../domain/coupon-customer";
import { calculateSellerCharges } from "../domain/seller-charges";
import { shippingSelectionsSchema, type CheckoutInput } from "../schemas/checkout";
import {
  loadCheckoutCart,
  reserveCartAndCreateOrder,
  type CheckoutSession,
  type PendingOrder,
} from "./create-pending-order";
import { reactivateCartAfterPaymentFailure } from "./reactivate-cart";
import { quoteShippingForCart } from "./shipping-quotes";

/**
 * `paymentDeclined: true` means the order was created and then CANCELLED because the
 * provider refused the payment (stock released, coupon freed, cart reactivated when
 * possible). The idempotency key of this attempt is spent: the UI must generate a new
 * one (and a new card token) before retrying.
 */
export type CheckoutResult = { orderNumber: string; guestAccessToken?: string; paymentDeclined?: true };

type CheckoutRequest = { data: CheckoutInput; identity: CartIdentity; session: CheckoutSession };

export async function executeCheckout(
  input: CheckoutRequest,
  paymentProvider: PaymentProvider = mercadoPagoProvider,
): Promise<CheckoutResult> {
  // One instant for the whole checkout: every price is evaluated at `now`.
  const now = new Date();
  // The injected provider is server-side only; no request or environment flag enables fake payments.
  const guestAccessToken = createGuestAccessToken(input.identity, input.data.checkoutIdempotencyKey);
  const existingOrder = await findExistingOrder(input.data.checkoutIdempotencyKey, input.identity, guestAccessToken);
  if (existingOrder)
    return createCheckoutResult(existingOrder.orderNumber, guestAccessToken, existingOrder.paymentDeclined);
  assertPaymentConfigured(paymentProvider, input.data.paymentMethodId);

  const { cart, coupon, sellerCharges } = await calculateCheckoutCharges(input, now);
  assertPaymentCanHandleSellers(sellerCharges.length, paymentProvider);

  const orderNumber = createOrderNumber(now);
  const order = await reserveCartAndCreateOrder({
    input,
    cart,
    sellerCharges,
    coupon,
    orderNumber,
    now,
    ...(guestAccessToken ? { guestAccessToken } : {}),
  });

  // Recorded BEFORE the request leaves: if this fails (or the process dies before it), the
  // charge provably never reached the provider and recovery may release the order.
  const requestSentAt = await markPaymentRequestSent(order, new Date());

  const outcome = await requestCheckoutPayment({
    paymentProvider,
    data: input.data,
    order,
    orderNumber,
    sellerCharges,
    requestSentAt,
  });
  return createCheckoutResult(orderNumber, guestAccessToken, outcome === "CANCELLED");
}

function createGuestAccessToken(identity: CartIdentity, checkoutIdempotencyKey: string): string | undefined {
  if (!("guestAccessTokenHash" in identity)) return undefined;
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`checkout:${identity.guestAccessTokenHash}:${checkoutIdempotencyKey}`)
    .digest("hex");
}

function createCheckoutResult(
  orderNumber: string,
  guestAccessToken: string | undefined,
  paymentDeclined: boolean,
): CheckoutResult {
  return {
    orderNumber,
    ...(guestAccessToken ? { guestAccessToken } : {}),
    ...(paymentDeclined ? { paymentDeclined: true as const } : {}),
  };
}

/** Loads the cart, coupon, shipping quotes and commission, then computes the per-seller charges at `now`. */
async function calculateCheckoutCharges(input: CheckoutRequest, now: Date) {
  const selections = parseShippingSelections(input.data.shippingSelections);
  const cart = await loadCheckoutCart(input.identity);
  const coupon = await loadCheckoutCoupon(input, now);
  const quoteGroups = await quoteShippingForCart(cart, input.data.postalCode);
  const defaultCommissionBps = await loadDefaultCommissionBps();
  const sellerCharges = calculateSellerCharges({
    items: cart.items,
    quoteGroups,
    selections,
    coupon,
    defaultCommissionBps,
    now,
  });
  return { cart, coupon, sellerCharges };
}

/** The active coupon, plus the sellers joined to it when it is a seller-funded campaign. */
async function loadCheckoutCoupon(input: CheckoutRequest, now: Date) {
  const coupon = await findActiveCoupon(
    input.data.couponCode,
    couponCustomerOf(input.data, input.session?.user.id),
    now,
  );
  if (!coupon || !isSellerFundedCampaign(coupon)) return coupon;

  return { ...coupon, participatingSellerIds: await listActiveCouponParticipantSellerIds(coupon.id) };
}

async function loadDefaultCommissionBps(): Promise<number> {
  const marketplaceConfig = await db.marketplaceConfiguration.findUnique({ where: { key: "default" } });
  if (!marketplaceConfig)
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "A comissão padrão do marketplace ainda não foi configurada.",
    });
  return marketplaceConfig.defaultCommissionBps;
}

type CheckoutPaymentRequest = {
  paymentProvider: PaymentProvider;
  data: CheckoutInput;
  order: PendingOrder;
  orderNumber: string;
  sellerCharges: ReadonlyArray<{ commissionInCents: number }>;
  requestSentAt: Date;
};

/**
 * Sends the charge and settles the order with the answer. Errors never escape: the order
 * either settles or stays pending for reconciliation.
 */
async function requestCheckoutPayment(
  request: CheckoutPaymentRequest,
): Promise<PendingOrderPaymentOutcome | undefined> {
  const { data, order, sellerCharges } = request;
  try {
    const paymentResult = await request.paymentProvider.createPayment({
      orderNumber: request.orderNumber,
      amountInCents: order.totalAmountInCents,
      payerEmail: data.customerEmail,
      payerTaxId: data.customerTaxId,
      paymentMethodId: data.paymentMethodId,
      ...(data.paymentToken ? { paymentToken: data.paymentToken } : {}),
      ...(data.issuerId ? { issuerId: data.issuerId } : {}),
      installments: 1,
      // TODO(regra-de-negócio): a taxa do marketplace (application_fee) é a soma das comissões e não
      // desconta o cupom financiado pelo MARKETPLACE. Como o cliente paga o total já com desconto, o
      // seller recebe (total - fee), ou seja, na prática o seller banca um desconto que deveria ser do
      // marketplace. Definir com produto se a fee deve ser reduzida pelo marketplaceDiscountInCents.
      // Enquanto isso, calculateSellerCharges recusa cedo (erro do cupom) qualquer fee > total do seller.
      applicationFeeInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.commissionInCents)),
      idempotencyKey: data.checkoutIdempotencyKey,
      sellerCount: sellerCharges.length,
    });
    return await settleCheckoutPayment(order, paymentResult, "Payment declined");
  } catch (error) {
    return handlePaymentRequestFailure(error, order, request.requestSentAt);
  }
}

async function handlePaymentRequestFailure(
  error: unknown,
  order: PendingOrder,
  requestSentAt: Date,
): Promise<PendingOrderPaymentOutcome | undefined> {
  const definitive = error instanceof PaymentProviderError && error.details.outcome === "DEFINITIVE_REJECTION";
  // A timeout can happen AFTER the provider accepted a charge. Keep the order and
  // reservation pending for reconciliation instead of allowing a second charge.
  const outcome =
    error instanceof PaymentProviderError && definitive
      ? await settleDefinitiveRejection(order, requestSentAt, error.details.httpStatus)
      : undefined;
  logger.error({
    event: definitive ? "checkout.payment.rejected" : "checkout.payment_confirmation_pending",
    orderId: order.orderId,
    errorType: error instanceof Error ? error.name : "UnknownError",
    ...(error instanceof PaymentProviderError
      ? { providerHttpStatus: error.details.httpStatus, providerCode: error.details.providerCode }
      : {}),
  });
  return outcome;
}

async function settleDefinitiveRejection(
  order: PendingOrder,
  requestSentAt: Date,
  httpStatus: PaymentProviderError["details"]["httpStatus"],
): Promise<PendingOrderPaymentOutcome | undefined> {
  const rejectionMetadata = rejectedPaymentRequestMetadata({
    sentAt: requestSentAt,
    rejectedAt: new Date(),
    httpStatus,
  });
  try {
    // Persist the definitive rejection first: if the settlement below fails, the
    // recovery workflow can still release stock and coupon from this marker.
    await db.paymentTransaction.updateMany({
      where: { id: order.paymentTransactionId, status: "PENDING" },
      data: { providerMetadata: rejectionMetadata as Prisma.InputJsonValue },
    });
    return await settleCheckoutPayment(
      order,
      { status: "FAILED", providerMetadata: rejectionMetadata, failedAt: new Date() },
      "Payment request rejected by provider",
    );
  } catch (settlementError) {
    logger.error({
      event: "checkout.payment_rejection_settlement_failed",
      orderId: order.orderId,
      errorType: settlementError instanceof Error ? settlementError.name : "UnknownError",
    });
    return undefined;
  }
}

/**
 * Marks the AUTHORIZATION transaction as SENT under the same order lock the recovery
 * takes before releasing a never-sent charge, so a request is never sent for an order
 * that recovery already cancelled.
 */
async function markPaymentRequestSent(pendingOrder: PendingOrder, sentAt: Date): Promise<Date> {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${pendingOrder.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: pendingOrder.orderId }, select: { status: true } });
    const marked =
      order.status === "PENDING_PAYMENT"
        ? await tx.paymentTransaction.updateMany({
            where: { id: pendingOrder.paymentTransactionId, status: "PENDING" },
            data: { providerMetadata: sentPaymentRequestMetadata(sentAt) as Prisma.InputJsonValue },
          })
        : { count: 0 };
    if (marked.count !== 1)
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Este pedido não está mais aguardando pagamento. Nenhuma cobrança foi criada.",
      });
  });
  return sentAt;
}

/** Applies the provider answer to the still-pending order and, on failure, gives the cart back. */
async function settleCheckoutPayment(
  pendingOrder: PendingOrder,
  paymentResult: ApplyPaymentOutcomeInput["result"],
  releaseReason: string,
): Promise<PendingOrderPaymentOutcome | undefined> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${pendingOrder.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: pendingOrder.orderId },
      include: { sellerOrders: { include: { items: true } } },
    });
    if (order.status !== "PENDING_PAYMENT") return undefined;
    const outcome = await applyPaymentOutcome(tx, {
      order,
      paymentId: pendingOrder.paymentId,
      transactionId: pendingOrder.paymentTransactionId,
      result: paymentResult,
      releaseReason,
    });
    if (outcome === "CANCELLED") await reactivateCartAfterPaymentFailure(tx, pendingOrder.cartId);
    return outcome;
  });
}

async function findExistingOrder(
  idempotencyKey: string,
  identity: CartIdentity,
  guestAccessToken?: string,
): Promise<{ orderNumber: string; paymentDeclined: boolean } | undefined> {
  const transaction = await db.paymentTransaction.findUnique({
    where: { idempotencyKey },
    include: { payment: { include: { order: true } } },
  });
  if (!transaction) return undefined;
  const order = transaction.payment.order;
  const owned =
    "userId" in identity
      ? order.userId === identity.userId
      : Boolean(guestAccessToken && order.guestAccessTokenHash === hashGuestToken(guestAccessToken));
  if (!owned)
    throw new ApplicationError({ code: "CONFLICT", message: "Esta tentativa de compra não pertence à sua sessão." });
  return {
    orderNumber: order.orderNumber,
    paymentDeclined: order.status === "CANCELLED" && ["FAILED", "CANCELLED"].includes(transaction.payment.status),
  };
}

function parseShippingSelections(value: string): Record<string, string> {
  try {
    return shippingSelectionsSchema.parse(JSON.parse(value));
  } catch {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Escolha uma opção de frete para cada loja." });
  }
}
