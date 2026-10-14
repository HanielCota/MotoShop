// Formatos aceitos (BUG-018): "1499,90", "1.499,90", "1.499", "12.5", "10".
// Vírgula é sempre o decimal; ponto seguido de 3 dígitos em grupos é milhar.
const DECIMAL_COMMA = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/;
const THOUSANDS_ONLY = /^\d{1,3}(?:\.\d{3})+$/;
const DECIMAL_DOT = /^(\d+)(?:\.(\d{1,2}))?$/;

export function parsePriceInputToCents(value: FormDataEntryValue | undefined): number {
  if (typeof value !== "string") return Number.NaN;
  const parts = splitPriceInput(value.trim());
  if (!parts) return Number.NaN;

  const cents = Number(parts.whole) * 100 + Number(parts.fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}

function splitPriceInput(input: string): { whole: string; fraction: string } | null {
  const withComma = DECIMAL_COMMA.exec(input);
  if (withComma) return { whole: (withComma[1] ?? "").replaceAll(".", ""), fraction: withComma[2] ?? "" };
  if (THOUSANDS_ONLY.test(input)) return { whole: input.replaceAll(".", ""), fraction: "" };

  const withDot = DECIMAL_DOT.exec(input);
  if (withDot) return { whole: withDot[1] ?? "", fraction: withDot[2] ?? "" };
  return null;
}

export function formatPriceInputFromCents(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}
