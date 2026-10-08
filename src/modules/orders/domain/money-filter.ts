const moneyFilterPattern = /^\d{1,9}(?:[,.]\d{1,2})?$/;

/** Parses a currency amount into integer cents without floating-point math. */
export function parseMoneyFilterToCents(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized || !moneyFilterPattern.test(normalized)) return null;

  const [wholePart, fractionPart = ""] = normalized.split(/[,.]/);
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(2, "0"));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}
