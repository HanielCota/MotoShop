export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly details: {
      httpStatus: number;
      outcome: "DEFINITIVE_REJECTION" | "UNKNOWN";
      providerCode?: string;
    },
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
