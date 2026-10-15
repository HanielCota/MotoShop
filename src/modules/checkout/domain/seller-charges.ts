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
  const pricedItems = input.items.map((item) => ({
    ...item,
    unitPriceInCents: getCurrentPriceInCents(item.variant, input.now),
  }));
  const rawCharges = Array.from(Map.groupBy(pricedItems, (item) => item.variant.product.sellerId).entries()).map(
    ([sellerId, sellerItems]) => createRawSellerCharge(sellerId, sellerItems, input.quoteGroups, input.selections),
  );
  const discounts = allocateCouponDiscounts(rawCharges, input.coupon);

  return rawCharges.map((charge, index) =>
    completeSellerCharge(charge, discounts[index] ?? 0, input.coupon, input.defaultCommissionBps),
  );
}

type RawSellerCharge<Item extends SellerChargeItem, Quote extends SellerChargeShippingQuote> = Pick<
  SellerCharge<Item, Quote>,
  "sellerId" | "items" | "storeId" | "storeName" | "shipping" | "totals"
>;

/** Groups one seller's items with the selected shipping quote, before any coupon discount. */
function createRawSellerCharge<Item extends SellerChargeItem, Quote extends SellerChargeShippingQuote>(
  sellerId: string,
  sellerItems: Array<PricedSellerChargeItem<Item>>,
  quoteGroups: ReadonlyArray<{ sellerId: string; quotes: readonly Quote[] }>,
  selections: Record<string, string>,
): RawSellerCharge<Item, Quote> {
  const quoteGroup = quoteGroups.find((group) => group.sellerId === sellerId);
  const firstItem = sellerItems[0];
  const shipping = quoteGroup?.quotes.find((quote) => quote.serviceCode === selections[sellerId]);
  if (!quoteGroup || !shipping || !firstItem) {
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Escolha uma opção de frete para cada loja." });
  }

  const totals = calculateOrderTotals({
    lines: toOrderLines(sellerItems),
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
}

/** Coupon discount per seller, in the same order as `rawCharges`. */
function allocateCouponDiscounts(
  rawCharges: ReadonlyArray<{ sellerId: string; totals: { itemsSubtotalInCents: number } }>,
  coupon: SellerChargeCoupon | undefined,
): number[] {
  if (!coupon) return rawCharges.map(() => 0);

  const rawSubtotals = rawCharges.map((charge) => charge.totals.itemsSubtotalInCents);
  if (coupon.ownerType === "MARKETPLACE") {
    return allocateDiscountAcrossSubtotals(
      rawSubtotals,
      calculateCouponDiscount(coupon, sumMoneyInCents(rawSubtotals)),
    );
  }

  const sellerSubtotal = rawCharges.find((charge) => charge.sellerId === coupon.sellerId)?.totals.itemsSubtotalInCents;
  const couponDiscount = calculateCouponDiscount(coupon, sellerSubtotal ?? 0);
  return rawCharges.map((charge) => (charge.sellerId === coupon.sellerId ? couponDiscount : 0));
}

function completeSellerCharge<Item extends SellerChargeItem, Quote extends SellerChargeShippingQuote>(
  charge: RawSellerCharge<Item, Quote>,
  discountInCents: number,
  coupon: SellerChargeCoupon | undefined,
  defaultCommissionBps: number,
): SellerCharge<Item, Quote> {
  const totals = calculateOrderTotals({
    lines: toOrderLines(charge.items),
    orderDiscountAmountInCents: discountInCents,
    shippingAmountInCents: charge.shipping.priceInCents,
  });
  const commissionBps = charge.items[0]?.variant.product.seller.commissionBpsOverride ?? defaultCommissionBps;
  // TODO(regra-de-negócio): a comissão incide sobre o subtotal BRUTO dos itens (antes do cupom).
  // Para cupom financiado pelo seller isso significa comissão sobre um valor que o cliente não pagou.
  // Confirmar com produto se a base deve ser o subtotal líquido (itemsSubtotal - desconto do seller).
  const commissionInCents = calculateCommissionInCents(totals.itemsSubtotalInCents, commissionBps);
  const sellerFundedDiscount = coupon?.fundedBy === "SELLER" ? discountInCents : 0;
  const sellerNetAmountInCents = totals.itemsSubtotalInCents - sellerFundedDiscount - commissionInCents;
  assertSellerChargeIsPayable({ charge, totals, commissionInCents, sellerNetAmountInCents, coupon });

  return {
    ...charge,
    totals,
    commissionBps,
    commissionInCents,
    marketplaceDiscountInCents: coupon?.fundedBy === "MARKETPLACE" ? discountInCents : 0,
    sellerDiscountInCents: sellerFundedDiscount,
    sellerNetAmountInCents,
  };
}

function assertSellerChargeIsPayable(input: {
  charge: { storeName: string };
  totals: { totalAmountInCents: number };
  commissionInCents: number;
  sellerNetAmountInCents: number;
  coupon: SellerChargeCoupon | undefined;
}): void {
  if (input.sellerNetAmountInCents < 0)
    throw new ApplicationError({
      code: "CONFLICT",
      message: "Este cupom não pode ser combinado com as condições atuais da loja.",
    });
  // The marketplace fee (application_fee) is taken from what the customer pays to THIS
  // seller. A large marketplace-funded coupon can push that below the commission, which the
  // provider rejects. Fail before creating the order; the commission policy is unchanged.
  if (input.commissionInCents > input.totals.totalAmountInCents)
    throw new ApplicationError({
      code: "CONFLICT",
      message: input.coupon
        ? `O desconto deste cupom é maior do que o valor que pode ser cobrado nos itens de ${input.charge.storeName}. Remova o cupom ou adicione outros itens.`
        : "Não foi possível calcular a cobrança desta loja. Tente novamente mais tarde.",
      statusCode: 409,
    });
}

function toOrderLines(items: ReadonlyArray<{ unitPriceInCents: number; quantity: number }>) {
  return items.map((item) => ({ unitPriceInCents: item.unitPriceInCents, quantity: item.quantity }));
}
