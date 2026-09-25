export type PaymentProviderStatus =
  "PENDING" | "PROCESSING" | "AUTHORIZED" | "APPROVED" | "FAILED" | "CANCELLED" | "PARTIALLY_REFUNDED" | "REFUNDED";

export type CreatePaymentInput = {
  orderNumber: string;
  amountInCents: number;
  payerEmail: string;
  payerTaxId?: string;
  paymentMethodId: string;
  paymentToken?: string;
  issuerId?: string;
  installments?: number;
  applicationFeeInCents?: number;
  idempotencyKey: string;
  sellerCount: number;
};

export type CreatePaymentResult = {
  externalId: string;
  status: PaymentProviderStatus;
  providerMetadata: Record<string, unknown>;
  authorizedAt?: Date;
  paidAt?: Date;
  failedAt?: Date;
};

export type GetPaymentResult = CreatePaymentResult;

export interface PaymentRecoveryProvider {
  getPayment(externalId: string): Promise<GetPaymentResult>;
  findPaymentByOrderNumber(orderNumber: string): Promise<GetPaymentResult | null>;
}

export type RefundPaymentInput = {
  externalId: string;
  amountInCents?: number;
  idempotencyKey: string;
};

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPayment(externalId: string): Promise<GetPaymentResult>;
  refund(input: RefundPaymentInput): Promise<CreatePaymentResult>;
  supportsSellerCount(sellerCount: number): boolean;
}
