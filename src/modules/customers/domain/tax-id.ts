import { isValidCpf } from "@/modules/checkout/domain/cpf";

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_WEIGHTS = [6, ...CNPJ_FIRST_WEIGHTS];

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function cnpjCheckDigit(digits: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** CNPJ with valid check digits (14 digits, not all equal). */
export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;

  return (
    cnpjCheckDigit(value, CNPJ_FIRST_WEIGHTS) === Number(value[12]) &&
    cnpjCheckDigit(value, CNPJ_SECOND_WEIGHTS) === Number(value[13])
  );
}

/** Digits-only CPF or CNPJ with valid check digits. */
export function isValidTaxId(digits: string): boolean {
  return digits.length === 11 ? isValidCpf(digits) : isValidCnpj(digits);
}

/** Brazilian phone with area code: 10 digits (landline) or 11 digits (mobile, starting with 9). */
export function isValidBrazilianPhone(digits: string): boolean {
  return /^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits);
}

/** Masks CPF (000.000.000-00) or CNPJ (00.000.000/0000-00) while typing. */
export function formatTaxId(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11)
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Masks a phone as (00) 0000-0000 or (00) 00000-0000 while typing. */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";

  const area = digits.slice(0, 2);
  const number = digits.slice(2);
  const splitAt = number.length > 8 ? 5 : 4;
  return number.length > splitAt
    ? `(${area}) ${number.slice(0, splitAt)}-${number.slice(splitAt)}`
    : `(${area}) ${number}`;
}
