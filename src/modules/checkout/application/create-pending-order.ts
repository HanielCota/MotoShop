import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import type { getCurrentSession } from "@/modules/auth/application/authorization";
import { cartOwnerWhere, hashGuestToken, type CartIdentity } from "@/modules/cart/infrastructure/cart-access";
import {
  assertCouponStillAvailableLocked,
  type ActiveCoupon,
} from "@/modules/coupons/application/validate-coupon-for-customer";
import { reserveOrderInventory } from "@/modules/inventory/application/reserve-order-inventory";
import { multiplyMoneyInCents, sumMoneyInCents } from "@/modules/orders/domain/money";
import { preparedPaymentRequestMetadata } from "@/modules/payments/domain/payment-request-state";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { buildVariantAttributesSnapshot, type VariantGenderValue } from "@/modules/products/domain/variant-attributes";
import { canonicalCouponCustomerEmail } from "@/modules/coupons/domain/coupon-customer-key";
import { ApplicationError } from "@/shared/errors/application-error";

import { couponCustomerOf } from "../domain/coupon-customer";
import { applyOrderItemDiscounts } from "../domain/order-item-discounts";
import type { SellerCharge } from "../domain/seller-charges";
import type { CheckoutInput } from "../schemas/checkout";
import type { CheckoutShippingQuote } from "./shipping-quotes";

export type CheckoutSession = Awaited<ReturnType<typeof getCurrentSession>>;

export async function loadCheckoutCart(identity: CartIdentity) {
  const cart = await db.cart.findFirst({
    where: { ...cartOwnerWhere(identity), status: "ACTIVE" },
    include: {
      items: {
        include: {
          variant: {
            include: {
              inventory: true,
              product: { include: { seller: { include: { store: true } }, store: true } },
            },
          },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0)
    throw new ApplicationError({ code: "NOT_FOUND", message: "Seu carrinho está vazio." });
  if (cart.items.some((item) => item.variant.product.isDemo))
    throw new ApplicationError({ code: "CONFLICT", message: "Itens de demonstração não podem ser comprados." });
  return cart;
}

export type CheckoutCart = Awaited<ReturnType<typeof loadCheckoutCart>>;
export type CheckoutSellerCharge = SellerCharge<CheckoutCart["items"][number], CheckoutShippingQuote>;
export type PendingOrder = {
  orderId: string;
  paymentId: string;
  paymentTransactionId: string;
  totalAmountInCents: number;
  cartId: string;
};

type ReserveCartInput = {
  input: { data: CheckoutInput; session: CheckoutSession };
  cart: CheckoutCart;
  sellerCharges: CheckoutSellerCharge[];
  coupon?: ActiveCoupon | undefined;
  orderNumber: string;
  guestAccessToken?: string;
  now: Date;
};

type CheckoutTotals = { totalAmountInCents: number; totalDiscountInCents: number; totalShippingInCents: number };

/**
 * One transaction: converts the cart, re-validates prices/availability/shipping at the
 * checkout instant, creates order + seller orders + items, reserves stock, creates the
 * pending payment and redeems the coupon under a row lock.
 */
export async function reserveCartAndCreateOrder(input: ReserveCartInput): Promise<PendingOrder> {
  const { data, session } = input.input;
  const totals = sumCheckoutTotals(input.sellerCharges);
  if (totals.totalAmountInCents <= 0)
    throw new ApplicationError({ code: "CONFLICT", message: "O total da compra deve ser maior que zero." });
  return db.$transaction(async (tx) => {
    await convertCart(tx, input.cart.id);
    await assertCartItemsUnchanged(tx, input.cart);
    await lockAndRecheckChargedPrices(tx, input.sellerCharges, input.now);
    const order = await createOrder(tx, input, totals);
    for (const charge of input.sellerCharges) {
      await createSellerOrder(tx, { charge, orderId: order.id, postalCode: data.postalCode });
    }

    const payment = await createPendingPayment(tx, {
      orderId: order.id,
      data,
      totalAmountInCents: totals.totalAmountInCents,
    });
    if (input.coupon) {
      await assertCouponStillAvailableLocked(tx, input.coupon, couponCustomerOf(data, session?.user.id), input.now);
      await redeemCoupon(tx, { coupon: input.coupon, orderId: order.id, data, session, totals });
    }
    const transaction = payment.transactions[0];
    if (!transaction)
      throw new ApplicationError({ code: "INTERNAL_ERROR", message: "Transação de pagamento não encontrada." });
    return {
      orderId: order.id,
      paymentId: payment.id,
      paymentTransactionId: transaction.id,
      totalAmountInCents: totals.totalAmountInCents,
      cartId: input.cart.id,
    };
  });
}

function sumCheckoutTotals(sellerCharges: readonly CheckoutSellerCharge[]): CheckoutTotals {
  return {
    totalAmountInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.totalAmountInCents)),
    totalDiscountInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.discountAmountInCents)),
    totalShippingInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.shippingAmountInCents)),
  };
}

async function convertCart(tx: Prisma.TransactionClient, cartId: string): Promise<void> {
  const converted = await tx.cart.updateMany({
    where: { id: cartId, status: "ACTIVE" },
    data: { status: "CONVERTED" },
  });
  if (converted.count !== 1)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este carrinho já está sendo finalizado. Consulte seus pedidos antes de tentar novamente.",
    });
}

async function assertCartItemsUnchanged(tx: Prisma.TransactionClient, cart: CheckoutCart): Promise<void> {
  const currentItems = await tx.cartItem.findMany({
    where: { cartId: cart.id },
    select: { variantId: true, quantity: true },
  });
  const isInSnapshot = (item: { variantId: string; quantity: number }) =>
    cart.items.some((snapshot) => snapshot.variantId === item.variantId && snapshot.quantity === item.quantity);
  if (currentItems.length !== cart.items.length || !currentItems.every(isInSnapshot))
    throw new ApplicationError({
      code: "CONFLICT",
      message: "O carrinho mudou. Revise os itens e calcule o frete novamente.",
    });
}

async function lockAndRecheckChargedPrices(
  tx: Prisma.TransactionClient,
  sellerCharges: readonly CheckoutSellerCharge[],
  now: Date,
): Promise<void> {
  const chargedItems = sellerCharges.flatMap((charge) => charge.items);
  // FOR SHARE on the variant rows (sorted ids, deadlock-free ordering) makes the price/active
  // check below stable until commit: a concurrent seller price edit waits for this checkout.
  // Product/seller/category status are re-read here but not locked (admin moderation may
  // still race; it does not change the charged amount).
  const variantIds = [...new Set(chargedItems.map((item) => item.variantId))].sort();
  await tx.$queryRaw`SELECT id FROM "product_variants" WHERE id IN (${Prisma.join(variantIds)}) ORDER BY id FOR SHARE`;
  for (const item of chargedItems) {
    const fresh = await tx.productVariant.findFirst({
      where: {
        id: item.variantId,
        active: true,
        product: {
          status: "APPROVED",
          isDemo: false,
          seller: { status: { in: ["APPROVED", "ACTIVE"] } },
          category: { active: true },
          brand: { active: true },
        },
      },
    });
    // Compare the locked, fresh price at the SAME checkout instant against the unit
    // price that was actually charged in the computed lines.
    if (!fresh || getCurrentPriceInCents(fresh, now) !== item.unitPriceInCents)
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Um produto mudou de preço ou disponibilidade. Revise o carrinho.",
      });
  }
}

async function createOrder(tx: Prisma.TransactionClient, input: ReserveCartInput, totals: CheckoutTotals) {
  const { data, session } = input.input;
  return tx.order.create({
    data: {
      orderNumber: input.orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      ...(data.customerTaxId ? { customerTaxId: data.customerTaxId } : {}),
      ...(session ? { userId: session.user.id } : {}),
      ...(input.guestAccessToken ? { guestAccessTokenHash: hashGuestToken(input.guestAccessToken) } : {}),
      itemsSubtotalInCents: sumMoneyInCents(input.sellerCharges.map((charge) => charge.totals.itemsSubtotalInCents)),
      discountAmountInCents: totals.totalDiscountInCents,
      shippingAmountInCents: totals.totalShippingInCents,
      customerShippingAmountInCents: totals.totalShippingInCents,
      totalAmountInCents: totals.totalAmountInCents,
      shippingAddress: { create: createShippingAddress(data) },
    },
  });
}

/** Creates one seller order with its shipment and items, then reserves its stock. */
async function createSellerOrder(
  tx: Prisma.TransactionClient,
  input: { charge: CheckoutSellerCharge; orderId: string; postalCode: string },
): Promise<void> {
  const { charge } = input;
  if (charge.shipping.provider === "OWN") await assertOwnShippingMethodUnchanged(tx, charge, input.postalCode);
  const sellerOrder = await tx.sellerOrder.create({
    data: {
      orderId: input.orderId,
      sellerId: charge.sellerId,
      storeId: charge.storeId,
      storeNameSnapshot: charge.storeName,
      itemsSubtotalInCents: charge.totals.itemsSubtotalInCents,
      discountAmountInCents: charge.totals.discountAmountInCents,
      shippingAmountInCents: charge.totals.shippingAmountInCents,
      customerShippingAmountInCents: charge.totals.customerShippingAmountInCents,
      marketplaceDiscountInCents: charge.marketplaceDiscountInCents,
      sellerDiscountInCents: charge.sellerDiscountInCents,
      commissionBps: charge.commissionBps,
      marketplaceCommissionInCents: charge.commissionInCents,
      sellerNetAmountInCents: charge.sellerNetAmountInCents,
      shipment: { create: createShipment(charge.shipping) },
      items: {
        create: applyOrderItemDiscounts(charge.items.map(createOrderItem), charge.totals.discountAmountInCents),
      },
    },
  });
  if (!sellerOrder.id)
    throw new ApplicationError({ code: "INTERNAL_ERROR", message: "Não foi possível criar o pedido do lojista." });
  await reserveOrderInventory(tx, charge, input.orderId);
}

async function assertOwnShippingMethodUnchanged(
  tx: Prisma.TransactionClient,
  charge: CheckoutSellerCharge,
  postalCode: string,
): Promise<void> {
  const method = await tx.sellerShippingMethod.findFirst({
    where: {
      id: charge.shipping.serviceCode.slice(4),
      sellerId: charge.sellerId,
      active: true,
      postalCodeStart: { lte: postalCode },
      postalCodeEnd: { gte: postalCode },
      priceInCents: charge.shipping.priceInCents,
      ...(charge.shipping.estimatedDeliveryDays !== undefined
        ? { estimatedDeliveryDays: charge.shipping.estimatedDeliveryDays }
        : {}),
    },
  });
  if (!method)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "A modalidade de entrega mudou. Calcule o frete novamente.",
    });
}

function createShipment(shipping: CheckoutShippingQuote) {
  return {
    provider: shipping.provider,
    serviceCode: shipping.serviceCode,
    carrier: shipping.carrier,
    service: shipping.service,
    priceInCents: shipping.priceInCents,
    ...(shipping.estimatedDeliveryDays !== undefined ? { estimatedDeliveryDays: shipping.estimatedDeliveryDays } : {}),
  };
}

async function createPendingPayment(
  tx: Prisma.TransactionClient,
  input: { orderId: string; data: CheckoutInput; totalAmountInCents: number },
) {
  return tx.payment.create({
    data: {
      provider: "MERCADO_PAGO",
      method: input.data.paymentMethodId,
      amountInCents: input.totalAmountInCents,
      orderId: input.orderId,
      transactions: {
        create: {
          type: "AUTHORIZATION",
          amountInCents: input.totalAmountInCents,
          idempotencyKey: input.data.checkoutIdempotencyKey,
          // Not sent to the provider yet; see payments/domain/payment-request-state.ts.
          providerMetadata: preparedPaymentRequestMetadata() as Prisma.InputJsonValue,
        },
      },
    },
    include: { transactions: true },
  });
}

async function redeemCoupon(
  tx: Prisma.TransactionClient,
  input: {
    coupon: ActiveCoupon;
    orderId: string;
    data: CheckoutInput;
    session: CheckoutSession;
    totals: CheckoutTotals;
  },
): Promise<void> {
  await tx.couponRedemption.create({
    data: {
      customerEmailSnapshot: input.data.customerEmail,
      customerEmailKey: canonicalCouponCustomerEmail(input.data.customerEmail),
      discountAmountInCents: input.totals.totalDiscountInCents,
      couponId: input.coupon.id,
      orderId: input.orderId,
      ...(input.session ? { userId: input.session.user.id } : {}),
    },
  });
}

export function createShippingAddress(data: CheckoutInput) {
  return {
    recipient: data.customerName,
    postalCode: data.postalCode,
    street: data.street,
    number: data.number,
    complement: data.complement ?? null,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
  };
}

export function createOrderItem(item: {
  variantId: string;
  quantity: number;
  /** Unit price frozen when the seller charges were computed. */
  unitPriceInCents: number;
  variant: {
    productId: string;
    sku: string;
    title: string;
    attributes: unknown;
    gender: VariantGenderValue | null;
    color: string | null;
    size: string | null;
    weightInGrams: number | null;
    heightInMillimeters: number | null;
    widthInMillimeters: number | null;
    lengthInMillimeters: number | null;
    product: {
      name: string;
      weightInGrams: number | null;
      heightInMillimeters: number | null;
      widthInMillimeters: number | null;
      lengthInMillimeters: number | null;
    };
  };
}) {
  return {
    productId: item.variant.productId,
    variantId: item.variantId,
    productNameSnapshot: item.variant.product.name,
    variantDescriptionSnapshot: item.variant.title,
    skuSnapshot: item.variant.sku,
    attributesSnapshot: buildVariantAttributesSnapshot(item.variant.attributes, item.variant) as Prisma.InputJsonValue,
    weightInGramsSnapshot: item.variant.weightInGrams ?? item.variant.product.weightInGrams,
    heightInMillimetersSnapshot: item.variant.heightInMillimeters ?? item.variant.product.heightInMillimeters,
    widthInMillimetersSnapshot: item.variant.widthInMillimeters ?? item.variant.product.widthInMillimeters,
    lengthInMillimetersSnapshot: item.variant.lengthInMillimeters ?? item.variant.product.lengthInMillimeters,
    unitPriceInCents: item.unitPriceInCents,
    quantity: item.quantity,
    totalAmountInCents: multiplyMoneyInCents(item.unitPriceInCents, item.quantity),
  };
}
