import { allocateDiscountAcrossSubtotals, calculateCouponDiscount } from "@/modules/coupons/domain/coupon-discount";
import { calculateCommissionInCents, sumMoneyInCents } from "@/modules/orders/domain/money";
import { calculateOrderTotals } from "@/modules/orders/domain/order-totals";
import { getCurrentPriceInCents } from "@/modules/products/domain/pricing";
import { ApplicationError } from "@/shared/errors/application-error";

export type SellerChargeItem = {
  quantity: number;
  variant: {
    priceInCents: number;
    promotionalPriceInCents: number | null;
    promotionStartsAt: Date | null;
    promotionEndsAt: Date | null;
    product: {
      sellerId: string;
      storeId: string;
      store: { name: string };
      seller: { commissionBpsOverride: number | null };
    };
  };
};

export type SellerChargeShippingQuote = {
  serviceCode: string;
  priceInCents: number;
};

export type SellerChargeCoupon = Parameters<typeof calculateCouponDiscount>[0] & {
  ownerType: "MARKETPLACE" | "SELLER";
  sellerId: string | null;
  fundedBy: "MARKETPLACE" | "SELLER";
};

export type PricedSellerChargeItem<Item extends SellerChargeItem> = Item & {
  /** Unit price frozen at checkout `now`; the order item and the locked recheck use this value. */
  unitPriceInCents: number;
};

export type SellerCharge<Item extends SellerChargeItem, Quote extends SellerChargeShippingQuote> = {
  sellerId: string;
  items: Array<PricedSellerChargeItem<Item>>;
  storeId: string;
  storeName: string;
  shipping: Quote;
  totals: ReturnType<typeof calculateOrderTotals>;
  commissionBps: number;
  commissionInCents: number;
  marketplaceDiscountInCents: number;
  sellerDiscountInCents: number;
  sellerNetAmountInCents: number;
};

/**
 * Pure calculation of the per-seller charge lines. The caller reads the marketplace
 * default commission from the database and freezes `now` once per checkout so every
 * price in the order is evaluated at the same instant.
 */
export function calculateSellerCharges<Item extends SellerChargeItem, Quote extends SellerChargeShippingQuote>(input: {
  items: readonly Item[];
  quoteGroups: ReadonlyArray<{ sellerId: string; quotes: readonly Quote[] }>;
  selections: Record<string, string>;
  coupon?: SellerChargeCoupon | undefined;
  defaultCommissionBps: number;
  now: Date;
}): Array<SellerCharge<Item, Quote>> {
  const { coupon } = input;
  const pricedItems = input.items.map((item) => ({
    ...item,
    unitPriceInCents: getCurrentPriceInCents(item.variant, input.now),
  }));
  const rawCharges = Array.from(Map.groupBy(pricedItems, (item) => item.variant.product.sellerId).entries()).map(
    ([sellerId, sellerItems]) => {
      const quoteGroup = input.quoteGroups.find((group) => group.sellerId === sellerId);
      const firstItem = sellerItems[0];
      const shipping = quoteGroup?.quotes.find((quote) => quote.serviceCode === input.selections[sellerId]);
      if (!quoteGroup || !shipping || !firstItem) {
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Escolha uma opção de frete para cada loja." });
      }

      const totals = calculateOrderTotals({
        lines: sellerItems.map((item) => ({ unitPriceInCents: item.unitPriceInCents, quantity: item.quantity })),
        shippingAmountInCents: shipping.priceInCents,
      });
      return {
        sellerId,
        items: sellerItems,
        storeId: firstItem.variant.product.storeId,
        storeName: firstItem.variant.product.store.name,
        shipping,
        totals,
      };
    },
  );

  const rawSubtotals = rawCharges.map((charge) => charge.totals.itemsSubtotalInCents);
  const totalSubtotal = sumMoneyInCents(rawSubtotals);
  const couponDiscount = coupon
    ? calculateCouponDiscount(
        coupon,
        coupon.ownerType === "SELLER"
          ? (rawCharges.find((charge) => charge.sellerId === coupon.sellerId)?.totals.itemsSubtotalInCents ?? 0)
          : totalSubtotal,
      )
    : 0;
  const allocations = coupon
    ? coupon.ownerType === "MARKETPLACE"
      ? allocateDiscountAcrossSubtotals(rawSubtotals, couponDiscount)
      : rawCharges.map((charge) => (charge.sellerId === coupon.sellerId ? couponDiscount : 0))
    : rawCharges.map(() => 0);

  return rawCharges.map((charge, index) => {
    const discountInCents = allocations[index] ?? 0;
    const totals = calculateOrderTotals({
      lines: charge.items.map((item) => ({ unitPriceInCents: item.unitPriceInCents, quantity: item.quantity })),
      orderDiscountAmountInCents: discountInCents,
      shippingAmountInCents: charge.shipping.priceInCents,
    });
    const commissionBps = charge.items[0]?.variant.product.seller.commissionBpsOverride ?? input.defaultCommissionBps;
    // TODO(regra-de-negócio): a comissão incide sobre o subtotal BRUTO dos itens (antes do cupom).
    // Para cupom financiado pelo seller isso significa comissão sobre um valor que o cliente não pagou.
    // Confirmar com produto se a base deve ser o subtotal líquido (itemsSubtotal - desconto do seller).
    const commissionInCents = calculateCommissionInCents(totals.itemsSubtotalInCents, commissionBps);
    const sellerFundedDiscount = coupon?.fundedBy === "SELLER" ? discountInCents : 0;
    if (totals.itemsSubtotalInCents - sellerFundedDiscount - commissionInCents < 0)
      throw new ApplicationError({
        code: "CONFLICT",
        message: "Este cupom não pode ser combinado com as condições atuais da loja.",
      });
    // The marketplace fee (application_fee) is taken from what the customer pays to THIS
    // seller. A large marketplace-funded coupon can push that below the commission, which the
    // provider rejects. Fail before creating the order; the commission policy is unchanged.
    if (commissionInCents > totals.totalAmountInCents)
      throw new ApplicationError({
        code: "CONFLICT",
        message: coupon
          ? `O desconto deste cupom é maior do que o valor que pode ser cobrado nos itens de ${charge.storeName}. Remova o cupom ou adicione outros itens.`
          : "Não foi possível calcular a cobrança desta loja. Tente novamente mais tarde.",
        statusCode: 409,
      });
    return {
      ...charge,
      totals,
      commissionBps,
      commissionInCents,
      marketplaceDiscountInCents: coupon?.fundedBy === "MARKETPLACE" ? discountInCents : 0,
      sellerDiscountInCents: sellerFundedDiscount,
      sellerNetAmountInCents: totals.itemsSubtotalInCents - sellerFundedDiscount - commissionInCents,
    };
  });
}
