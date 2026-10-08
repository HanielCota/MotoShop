/**
 * Formatação de valores para a interface (pt-BR).
 *
 * Datas são sempre exibidas no fuso de operação do marketplace. Sem `timeZone`
 * explícito, o servidor (UTC) renderiza pedidos feitos após 21h como o dia seguinte.
 */
export const MARKETPLACE_TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: MARKETPLACE_TIME_ZONE });
const longDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: MARKETPLACE_TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: MARKETPLACE_TIME_ZONE,
});
const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: DateInput): string {
  return dateFormatter.format(toDate(value));
}

export function formatLongDate(value: DateInput): string {
  return longDateFormatter.format(toDate(value));
}

export function formatDateTime(value: DateInput): string {
  return dateTimeFormatter.format(toDate(value));
}

export function formatMoneyInCents(amountInCents: number): string {
  return moneyFormatter.format(amountInCents / 100);
}
