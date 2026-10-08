export type ShippingProduct = {
  id: string;
  name?: string;
  unitaryValueInCents?: number;
  widthInCm: number;
  heightInCm: number;
  lengthInCm: number;
  weightInKg: number;
  /**
   * Valor UNITÁRIO segurado do produto. Na cotação por produtos o Melhor Envio calcula o total
   * multiplicando o `insurance_value` unitário pela `quantity` de cada item.
   */
  insuranceValueInCents: number;
  quantity: number;
};

export type ShippingQuoteInput = {
  fromPostalCode: string;
  toPostalCode: string;
  products: ShippingProduct[];
  services?: string[];
};

export type ShippingQuote = {
  provider: string;
  serviceCode: string;
  carrier: string;
  service: string;
  priceInCents: number;
  estimatedDeliveryDays?: number;
  /** Pacotes (volumes) que o provedor calculou para este serviço a partir dos produtos cotados. */
  packages?: ShippingPackage[];
  raw: Record<string, unknown>;
};

/** Inserção de um envio no carrinho do provedor (1º passo da compra; ainda não debita saldo). */
export type AddShipmentToCartInput = {
  sellerOrderId: string;
  serviceCode: string;
  from: ShippingAddress;
  to: ShippingAddress;
  /** Produtos da declaração de conteúdo (valor unitário + quantidade). */
  products: ShippingProduct[];
  /** Volumes exatamente como retornados nos `packages` da cotação do serviço contratado. */
  volumes: ShippingVolume[];
  /** Valor TOTAL segurado do envio. */
  insuranceValueInCents: number;
  tags?: Array<{ tag: string; url?: string }>;
};

export type ShippingAddress = Record<string, string | number | boolean>;

export type ShippingVolume = {
  heightInCm: number;
  widthInCm: number;
  lengthInCm: number;
  weightInKg: number;
};

export type ShippingPackage = ShippingVolume & {
  insuranceValueInCents?: number;
};

export type CartItemResult = {
  cartItemId: string;
  providerMetadata: Record<string, unknown>;
};

export type ShipmentResult = {
  externalShipmentId: string;
  providerMetadata: Record<string, unknown>;
  status?: string;
};

export type ShipmentGenerationResult = {
  externalShipmentId: string;
  providerMetadata: Record<string, unknown>;
};

export type TrackingResult = {
  status: string;
  trackingCode?: string;
  trackingUrl?: string;
  providerMetadata: Record<string, unknown>;
};

export interface ShippingProvider {
  quote(input: ShippingQuoteInput, accessToken: string): Promise<ShippingQuote[]>;
  /** Passo 1 da compra: cria o item no carrinho e devolve o id que deve ser persistido. */
  addToCart(input: AddShipmentToCartInput, accessToken: string): Promise<CartItemResult>;
  /** Passo 2 da compra: paga um item de carrinho já criado (reutilizado em novas tentativas). */
  checkoutCart(cartItemId: string, accessToken: string): Promise<ShipmentResult>;
  generateShipment(externalShipmentId: string, accessToken: string): Promise<ShipmentGenerationResult>;
  track(trackingCode: string, accessToken: string): Promise<TrackingResult>;
}
