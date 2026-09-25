export function parsePriceInputToCents(value: FormDataEntryValue | undefined): number {
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(normalized)) return Number.NaN;

  const [whole = "", fraction = ""] = normalized.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : Number.NaN;
}

export function formatPriceInputFromCents(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}
