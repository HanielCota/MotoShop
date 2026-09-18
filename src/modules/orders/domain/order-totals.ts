import { ApplicationError } from "@/shared/errors/application-error";

import { assertMoneyInCents, multiplyMoneyInCents, sumMoneyInCents } from "./money";

export type OrderLineInput = {
  unitPriceInCents: number;
  quantity: number;
  discountAmountInCents?: number;
};

export type CalculateOrderTotalsInput = {
  lines: readonly OrderLineInput[];
  orderDiscountAmountInCents?: number;
  shippingAmountInCents?: number;
  marketplaceShippingSubsidyInCents?: number;
  sellerShippingSubsidyInCents?: number;
};

export type OrderTotals = {
  itemsSubtotalInCents: number;
  discountAmountInCents: number;
  shippingAmountInCents: number;
  customerShippingAmountInCents: number;
  marketplaceSubsidyInCents: number;
  sellerSubsidyInCents: number;
  totalAmountInCents: number;
};

export function calculateOrderTotals(input: CalculateOrderTotalsInput): OrderTotals {
  const lineSubtotals = input.lines.map((line) => multiplyMoneyInCents(line.unitPriceInCents, line.quantity));
  const lineDiscounts = input.lines.map((line) => line.discountAmountInCents ?? 0);
  const itemsSubtotalInCents = sumMoneyInCents(lineSubtotals);
  const discountAmountInCents = sumMoneyInCents([...lineDiscounts, input.orderDiscountAmountInCents ?? 0]);
  const shippingAmountInCents = input.shippingAmountInCents ?? 0;
  const marketplaceSubsidyInCents = input.marketplaceShippingSubsidyInCents ?? 0;
  const sellerSubsidyInCents = input.sellerShippingSubsidyInCents ?? 0;

  assertMoneyInCents(shippingAmountInCents, "shippingAmountInCents");
  assertMoneyInCents(marketplaceSubsidyInCents, "marketplaceSubsidyInCents");
  assertMoneyInCents(sellerSubsidyInCents, "sellerSubsidyInCents");
  assertDiscountDoesNotExceedSubtotal(discountAmountInCents, itemsSubtotalInCents);
  const totalShippingSubsidyInCents = sumMoneyInCents([marketplaceSubsidyInCents, sellerSubsidyInCents]);
  assertShippingSubsidyDoesNotExceedShipping(totalShippingSubsidyInCents, shippingAmountInCents);
  const customerShippingAmountInCents = shippingAmountInCents - totalShippingSubsidyInCents;

  return {
    itemsSubtotalInCents,
    discountAmountInCents,
    shippingAmountInCents,
    customerShippingAmountInCents,
    marketplaceSubsidyInCents,
    sellerSubsidyInCents,
    totalAmountInCents: sumMoneyInCents([itemsSubtotalInCents - discountAmountInCents, customerShippingAmountInCents]),
  };
}

function assertShippingSubsidyDoesNotExceedShipping(
  totalShippingSubsidyInCents: number,
  shippingAmountInCents: number,
): void {
  if (totalShippingSubsidyInCents > shippingAmountInCents) {
    throw new ApplicationError({
      code: "INVALID_MONEY",
      message: "Shipping subsidies cannot exceed shippingAmountInCents.",
      statusCode: 400,
    });
  }
}

function assertDiscountDoesNotExceedSubtotal(discountAmountInCents: number, itemsSubtotalInCents: number): void {
  if (discountAmountInCents > itemsSubtotalInCents) {
    throw new ApplicationError({
      code: "INVALID_MONEY",
      message: "discountAmountInCents cannot exceed itemsSubtotalInCents.",
      statusCode: 400,
    });
  }
}
