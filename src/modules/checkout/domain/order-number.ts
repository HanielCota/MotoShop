import { randomUUID } from "node:crypto";

export function createOrderNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `MS-${date}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

/**
 * Recognizes order numbers issued by the Moto Shop (`MS-` prefix, as created above). Used to
 * tell Moto Shop charges apart from other payments of the same Mercado Pago account.
 */
export function isMotoShopOrderNumber(value: string): boolean {
  return /^MS-[A-Z0-9-]{1,40}$/i.test(value);
}
