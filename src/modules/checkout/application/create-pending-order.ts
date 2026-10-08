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
import { ApplicationError } from "@/shared/errors/application-error";

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

/**
 * One transaction: converts the cart, re-validates prices/availability/shipping at the
 * checkout instant, creates order + seller orders + items, reserves stock, creates the
 * pending payment and redeems the coupon under a row lock.
 */
export async function reserveCartAndCreateOrder(input: {
  input: { data: CheckoutInput; session: CheckoutSession };
  cart: CheckoutCart;
  sellerCharges: CheckoutSellerCharge[];
  coupon?: ActiveCoupon | undefined;
  orderNumber: string;
  guestAccessToken?: string;
  now: Date;
}): Promise<PendingOrder> {
  const { data, session } = input.input;
  const totalAmountInCents = sumMoneyInCents(input.sellerCharges.map((charge) => charge.totals.totalAmountInCents));
  const totalDiscountInCents = sumMoneyInCents(
    input.sellerCharges.map((charge) => charge.totals.discountAmountInCents),
  );
  const totalShippingInCents = sumMoneyInCents(
    input.sellerCharges.map((charge) => charge.totals.shippingAmountInCents),
  );
  if (totalAmountInCents <= 0)
    throw new ApplicationError({ code: "CONFLICT", message: "O total da compra deve ser maior que zero." });
  return db.$transaction(async (tx) => {
    const converted = await tx.cart.updateMany({
      where: { id: input.cart.id, status: "ACTIVE" },
      data: { status: "CONVERTED" },
    });
    if (converted.count !== 1)
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Este carrinho já está sendo finalizado. Consulte seus pedidos antes de tentar novamente.",
      });
    const currentItems = await tx.cartItem.findMany({
      where: { cartId: input.cart.id },
      select: { variantId: true, quantity: true },
    });
    if (
      currentItems.length !== input.cart.items.length ||
      currentItems.some(
        (item) =>
          !input.cart.items.some(
            (snapshot) => snapshot.variantId === item.variantId && snapshot.quantity === item.quantity,
          ),
      )
    )
      throw new ApplicationError({
        code: "CONFLICT",
        message: "O carrinho mudou. Revise os itens e calcule o frete novamente.",
      });
    const chargedItems = input.sellerCharges.flatMap((charge) => charge.items);
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
      if (!fresh || getCurrentPriceInCents(fresh, input.now) !== item.unitPriceInCents)
        throw new ApplicationError({
          code: "CONFLICT",
          message: "Um produto mudou de preço ou disponibilidade. Revise o carrinho.",
        });
    }
    const order = await tx.order.create({
      data: {
        orderNumber: input.orderNumber,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        ...(data.customerTaxId ? { customerTaxId: data.customerTaxId } : {}),
        ...(session ? { userId: session.user.id } : {}),
        ...(input.guestAccessToken ? { guestAccessTokenHash: hashGuestToken(input.guestAccessToken) } : {}),
        itemsSubtotalInCents: sumMoneyInCents(input.sellerCharges.map((charge) => charge.totals.itemsSubtotalInCents)),
        discountAmountInCents: totalDiscountInCents,
        shippingAmountInCents: totalShippingInCents,
        customerShippingAmountInCents: totalShippingInCents,
        totalAmountInCents,
        shippingAddress: { create: createShippingAddress(data) },
      },
    });

    for (const charge of input.sellerCharges) {
      if (charge.shipping.provider === "OWN") {
        const method = await tx.sellerShippingMethod.findFirst({
          where: {
            id: charge.shipping.serviceCode.slice(4),
            sellerId: charge.sellerId,
            active: true,
            postalCodeStart: { lte: data.postalCode },
            postalCodeEnd: { gte: data.postalCode },
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
      const sellerOrder = await tx.sellerOrder.create({
        data: {
          orderId: order.id,
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
          shipment: {
            create: {
              provider: charge.shipping.provider,
              serviceCode: charge.shipping.serviceCode,
              carrier: charge.shipping.carrier,
              service: charge.shipping.service,
              priceInCents: charge.shipping.priceInCents,
              ...(charge.shipping.estimatedDeliveryDays !== undefined
                ? { estimatedDeliveryDays: charge.shipping.estimatedDeliveryDays }
                : {}),
            },
          },
          items: {
            create: applyOrderItemDiscounts(charge.items.map(createOrderItem), charge.totals.discountAmountInCents),
          },
        },
      });
      if (!sellerOrder.id)
        throw new ApplicationError({ code: "INTERNAL_ERROR", message: "Não foi possível criar o pedido do lojista." });
      await reserveOrderInventory(tx, charge, order.id);
    }

    const payment = await tx.payment.create({
      data: {
        provider: "MERCADO_PAGO",
        method: data.paymentMethodId,
        amountInCents: totalAmountInCents,
        orderId: order.id,
        transactions: {
          create: {
            type: "AUTHORIZATION",
            amountInCents: totalAmountInCents,
            idempotencyKey: data.checkoutIdempotencyKey,
            // Not sent to the provider yet; see payments/domain/payment-request-state.ts.
            providerMetadata: preparedPaymentRequestMetadata() as Prisma.InputJsonValue,
          },
        },
      },
      include: { transactions: true },
    });
    if (input.coupon) {
      await assertCouponStillAvailableLocked(tx, input.coupon, data.customerEmail, session?.user.id, input.now);
      await tx.couponRedemption.create({
        data: {
          customerEmailSnapshot: data.customerEmail,
          discountAmountInCents: totalDiscountInCents,
          couponId: input.coupon.id,
          orderId: order.id,
          ...(session ? { userId: session.user.id } : {}),
        },
      });
    }
    const transaction = payment.transactions[0];
    if (!transaction)
      throw new ApplicationError({ code: "INTERNAL_ERROR", message: "Transação de pagamento não encontrada." });
    return {
      orderId: order.id,
      paymentId: payment.id,
      paymentTransactionId: transaction.id,
      totalAmountInCents,
      cartId: input.cart.id,
    };
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
    attributesSnapshot: item.variant.attributes as Prisma.InputJsonValue,
    weightInGramsSnapshot: item.variant.weightInGrams ?? item.variant.product.weightInGrams,
    heightInMillimetersSnapshot: item.variant.heightInMillimeters ?? item.variant.product.heightInMillimeters,
    widthInMillimetersSnapshot: item.variant.widthInMillimeters ?? item.variant.product.widthInMillimeters,
    lengthInMillimetersSnapshot: item.variant.lengthInMillimeters ?? item.variant.product.lengthInMillimeters,
    unitPriceInCents: item.unitPriceInCents,
    quantity: item.quantity,
    totalAmountInCents: multiplyMoneyInCents(item.unitPriceInCents, item.quantity),
  };
}
