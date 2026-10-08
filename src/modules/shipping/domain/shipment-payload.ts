import type { ShippingAddress, ShippingProduct, ShippingVolume } from "@/shared/shipping/shipping-provider";
import { ApplicationError } from "@/shared/errors/application-error";

export type ShipmentOriginStore = {
  originName: string | null;
  originEmail: string | null;
  originPhone: string | null;
  originDocument: string | null;
  originPostalCode: string | null;
  originStreet: string | null;
  originNumber: string | null;
  originComplement: string | null;
  originNeighborhood: string | null;
  originCity: string | null;
  originState: string | null;
  originStateRegister: string | null;
};

export type ShipmentItemSnapshot = {
  skuSnapshot: string | null;
  productNameSnapshot: string;
  unitPriceInCents: number;
  quantity: number;
  weightInGramsSnapshot: number | null;
  heightInMillimetersSnapshot: number | null;
  widthInMillimetersSnapshot: number | null;
  lengthInMillimetersSnapshot: number | null;
};

export type ShipmentPayloadSource = {
  seller: { type: "INDIVIDUAL" | "COMPANY" };
  store: ShipmentOriginStore;
  order: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerTaxId: string | null;
    shippingAddress: {
      street: string;
      number: string;
      complement: string | null;
      neighborhood: string;
      city: string;
      postalCode: string;
      country: string;
      state: string;
    } | null;
  };
  items: ShipmentItemSnapshot[];
};

/** Monta o payload de compra de etiqueta a partir dos snapshots congelados do pedido da loja. */
export function buildShipmentData(sellerOrder: ShipmentPayloadSource) {
  const address = sellerOrder.order.shippingAddress;
  if (!address)
    throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "O pedido não possui endereço de entrega." });

  const from = buildOriginAddress(sellerOrder.store, sellerOrder.seller.type);
  const to: ShippingAddress = {
    name: sellerOrder.order.customerName,
    email: sellerOrder.order.customerEmail,
    phone: sellerOrder.order.customerPhone,
    ...(sellerOrder.order.customerTaxId ? { document: sellerOrder.order.customerTaxId } : {}),
    address: address.street,
    number: address.number,
    ...(address.complement ? { complement: address.complement } : {}),
    district: address.neighborhood,
    city: address.city,
    postal_code: address.postalCode,
    country_id: address.country,
    state_abbr: address.state,
  };

  const products: ShippingProduct[] = sellerOrder.items.map((item) => {
    const dimensions = getItemDimensions(item);
    return {
      id: item.skuSnapshot || item.productNameSnapshot,
      name: item.productNameSnapshot,
      unitaryValueInCents: item.unitPriceInCents,
      ...dimensions,
      insuranceValueInCents: item.unitPriceInCents * item.quantity,
      quantity: item.quantity,
    };
  });
  const volumes: ShippingVolume[] = sellerOrder.items.map((item) => {
    const dimensions = getItemDimensions(item);
    return { ...dimensions, weightInKg: dimensions.weightInKg * item.quantity };
  });

  return {
    from,
    to,
    products,
    volumes,
    insuranceValueInCents: products.reduce((total, product) => total + product.insuranceValueInCents, 0),
  };
}

export function buildOriginAddress(store: ShipmentOriginStore, sellerType: "INDIVIDUAL" | "COMPANY"): ShippingAddress {
  const required = [
    store.originName,
    store.originEmail,
    store.originPhone,
    store.originDocument,
    store.originPostalCode,
    store.originStreet,
    store.originNumber,
    store.originNeighborhood,
    store.originCity,
    store.originState,
  ];
  if (required.some((value) => !value)) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Complete os dados de envio da loja antes de comprar a etiqueta.",
      statusCode: 409,
    });
  }

  return {
    name: store.originName!,
    email: store.originEmail!,
    phone: store.originPhone!,
    ...(sellerType === "COMPANY" ? { company_document: store.originDocument! } : { document: store.originDocument! }),
    address: store.originStreet!,
    number: store.originNumber!,
    ...(store.originComplement ? { complement: store.originComplement } : {}),
    district: store.originNeighborhood!,
    city: store.originCity!,
    postal_code: store.originPostalCode!,
    state_abbr: store.originState!,
    state_register: store.originStateRegister || "ISENTO",
    country_id: "BR",
  };
}

export function getItemDimensions(item: {
  weightInGramsSnapshot: number | null;
  heightInMillimetersSnapshot: number | null;
  widthInMillimetersSnapshot: number | null;
  lengthInMillimetersSnapshot: number | null;
}) {
  if (
    item.weightInGramsSnapshot === null ||
    item.heightInMillimetersSnapshot === null ||
    item.widthInMillimetersSnapshot === null ||
    item.lengthInMillimetersSnapshot === null
  ) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "Existe um item sem peso ou dimensões cadastradas para o envio.",
      statusCode: 409,
    });
  }
  return {
    weightInKg: item.weightInGramsSnapshot / 1000,
    heightInCm: item.heightInMillimetersSnapshot / 10,
    widthInCm: item.widthInMillimetersSnapshot / 10,
    lengthInCm: item.lengthInMillimetersSnapshot / 10,
  };
}
