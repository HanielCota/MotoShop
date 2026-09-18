export type ShippingProduct = {
  id: string;
  name?: string;
  unitaryValueInCents?: number;
  widthInCm: number;
  heightInCm: number;
  lengthInCm: number;
  weightInKg: number;
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
  raw: Record<string, unknown>;
};

export type CreateShipmentInput = {
  sellerOrderId: string;
  serviceCode: string;
  from: ShippingAddress;
  to: ShippingAddress;
  products: ShippingProduct[];
  volumes: ShippingVolume[];
  insuranceValueInCents: number;
  tags?: Array<{ tag: string; url?: string }>;
  quote: ShippingQuote;
};

export type ShippingAddress = Record<string, string | number | boolean>;

export type ShippingVolume = {
  heightInCm: number;
  widthInCm: number;
  lengthInCm: number;
  weightInKg: number;
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
  quote(input: ShippingQuoteInput): Promise<ShippingQuote[]>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  generateShipment(externalShipmentId: string): Promise<ShipmentGenerationResult>;
  track(trackingCode: string): Promise<TrackingResult>;
}
