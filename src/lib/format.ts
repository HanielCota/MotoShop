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
const spreadsheetMoneyFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
});
const yearFormatter = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: MARKETPLACE_TIME_ZONE });

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: DateInput): string {
  return dateFormatter.format(toDate(value));
}

/** Current year in the marketplace time zone, so the footers' © does not turn at 21h on 31 December. */
export function currentMarketplaceYear(): string {
  return yearFormatter.format(new Date());
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

/** Reais with a decimal comma and no thousands dot or symbol, which Excel in Portuguese reads as a number: 3903368 → "39033,68". */
export function formatMoneyInCentsForSpreadsheet(amountInCents: number): string {
  return spreadsheetMoneyFormatter.format(amountInCents / 100);
}

const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Percentage stored in basis points: 1250 → "12,5%". */
export function formatPercentFromBps(bps: number): string {
  return `${percentFormatter.format(bps / 100)}%`;
}

const countFormatter = new Intl.NumberFormat("pt-BR");

/** "1 pedido", "2 pedidos", "1.250 pedidos": quantidade com a palavra já no singular ou no plural. */
export function formatCount(count: number, singular: string, plural: string): string {
  return `${countFormatter.format(count)} ${count === 1 ? singular : plural}`;
}
