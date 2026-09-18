export type PaymentProviderStatus =
  "PENDING" | "PROCESSING" | "AUTHORIZED" | "APPROVED" | "FAILED" | "CANCELLED" | "PARTIALLY_REFUNDED" | "REFUNDED";

export type CreatePaymentInput = {
  orderNumber: string;
  amountInCents: number;
  payerEmail: string;
  paymentMethodId: string;
  paymentToken?: string;
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
