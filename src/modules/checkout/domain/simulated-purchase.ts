import { sumMoneyInCents } from "@/modules/orders/domain/money";

/**
 * What the "Compra concluída" screen shows after the simulated purchase of test products.
 * Built on the server from the priced cart, never from what the browser sent.
 */
export type SimulatedPurchase = {
  customer: { name: string; email: string; phone: string };
  address: {
    street: string;
    number: string;
    complement?: string | undefined;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
  paymentMethod: "pix";
  stores: Array<{
    storeName: string;
    items: Array<{ id: string; name: string; variant: string; quantity: number; lineTotalInCents: number }>;
    shipping: { label: string; estimatedDeliveryDays?: number | undefined; priceInCents: number };
  }>;
  totals: {
    itemCount: number;
    itemsSubtotalInCents: number;
    discountInCents: number;
    shippingInCents: number;
    totalInCents: number;
  };
};

type PricedItem = {
  id: string;
  quantity: number;
  unitPriceInCents: number;
  variant: { title: string; product: { name: string } };
};

type PricedSellerCharge = {
  storeName: string;
  items: PricedItem[];
  shipping: { carrier: string; service: string; estimatedDeliveryDays?: number | undefined };
  totals: {
    itemsSubtotalInCents: number;
    discountAmountInCents: number;
    customerShippingAmountInCents: number;
    totalAmountInCents: number;
  };
};

type CustomerData = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  street: string;
  number: string;
  complement?: string | undefined;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
};

export function buildSimulatedPurchase(data: CustomerData, sellerCharges: PricedSellerCharge[]): SimulatedPurchase {
  return {
    customer: { name: data.customerName, email: data.customerEmail, phone: data.customerPhone },
    address: {
      street: data.street,
      number: data.number,
      ...(data.complement ? { complement: data.complement } : {}),
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
    },
    paymentMethod: "pix",
    stores: sellerCharges.map(toSimulatedStore),
    totals: {
      itemCount: sellerCharges.flatMap((charge) => charge.items).reduce((total, item) => total + item.quantity, 0),
      itemsSubtotalInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.itemsSubtotalInCents)),
      discountInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.discountAmountInCents)),
      shippingInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.customerShippingAmountInCents)),
      totalInCents: sumMoneyInCents(sellerCharges.map((charge) => charge.totals.totalAmountInCents)),
    },
  };
}

function toSimulatedStore(charge: PricedSellerCharge): SimulatedPurchase["stores"][number] {
  return {
    storeName: charge.storeName,
    items: charge.items.map((item) => ({
      id: item.id,
      name: item.variant.product.name,
      variant: item.variant.title,
      quantity: item.quantity,
      lineTotalInCents: item.unitPriceInCents * item.quantity,
    })),
    shipping: {
      label: `${charge.shipping.carrier} · ${charge.shipping.service}`,
      ...(charge.shipping.estimatedDeliveryDays !== undefined
        ? { estimatedDeliveryDays: charge.shipping.estimatedDeliveryDays }
        : {}),
      priceInCents: charge.totals.customerShippingAmountInCents,
    },
  };
}
