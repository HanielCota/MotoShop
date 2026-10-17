import type { ChangeEvent } from "react";

/** A mask that keeps only digits and adds its own punctuation, like `formatCep` or `formatTaxId`. */
export type DigitMask = (value: string) => string;

/**
 * Applies a digit mask while the person types. The caret stays after the same digit it followed,
 * so editing in the middle of the value does not jump to the end. The value sent with the form is
 * the masked text; the server keeps reading only its digits.
 */
export function maskInput(input: HTMLInputElement, mask: DigitMask) {
  const caret = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = countDigits(input.value.slice(0, caret));
  const masked = mask(input.value);
  if (masked === input.value) return;

  input.value = masked;
  if (document.activeElement !== input) return;
  const position = positionAfterDigits(masked, digitsBeforeCaret);
  input.setSelectionRange(position, position);
}

/** `onChange` for an uncontrolled `<input>` that masks what is typed. */
export function maskOnChange(mask: DigitMask) {
  return (event: ChangeEvent<HTMLInputElement>) => maskInput(event.currentTarget, mask);
}

function countDigits(text: string): number {
  return text.replace(/\D/g, "").length;
}

function positionAfterDigits(text: string, digits: number): number {
  if (digits === 0) return 0;

  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!/\d/.test(text.charAt(index))) continue;
    seen += 1;
    if (seen === digits) return index + 1;
  }
  return text.length;
}
