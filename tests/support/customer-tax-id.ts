import { randomInt } from "node:crypto";

/** Independent, valid CPF for a disposable checkout fixture. */
export function createTestCustomerTaxId(): string {
  const digits = Array.from({ length: 9 }, () => randomInt(0, 10));
  const first = checkDigit(digits);
  return [...digits, first, checkDigit([...digits, first])].join("");
}

function checkDigit(digits: number[]): number {
  const remainder = digits.reduce((sum, digit, index) => sum + digit * (digits.length + 1 - index), 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
