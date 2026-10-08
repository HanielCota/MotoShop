import { ApplicationError } from "@/shared/errors/application-error";

/**
 * Erro HTTP retornado pelo provedor de frete.
 *
 * `definitive` indica que o provedor recusou a solicitação de forma explícita (4xx, exceto
 * 408/409/429): a operação não aconteceu e pode ser corrigida e tentada novamente. Os demais
 * casos (5xx, timeout, conflito, rate limit) têm resultado incerto.
 */
export class ShippingProviderRequestError extends ApplicationError {
  readonly providerStatus: number;
  readonly definitive: boolean;

  constructor(input: { message: string; providerStatus: number }) {
    super({
      code: "CONFLICT",
      message: input.message,
      statusCode: input.providerStatus >= 500 ? 502 : 409,
    });
    this.name = "ShippingProviderRequestError";
    this.providerStatus = input.providerStatus;
    this.definitive = isDefinitiveProviderStatus(input.providerStatus);
  }
}

const uncertainClientStatuses = new Set([408, 409, 429]);

export function isDefinitiveProviderStatus(status: number): boolean {
  return status >= 400 && status < 500 && !uncertainClientStatuses.has(status);
}

export function isDefinitiveProviderRejection(error: unknown): error is ShippingProviderRequestError {
  return error instanceof ShippingProviderRequestError && error.definitive;
}
