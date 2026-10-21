import { afterEach, expect, it } from "vitest";

import { formatCep } from "@/modules/customers/domain/brazilian-address";

import { maskInput } from "./digit-mask";

afterEach(() => {
  document.body.innerHTML = "";
});

function focusedInput(value: string, caret: number) {
  document.body.innerHTML = "<input />";
  const input = document.querySelector("input");
  if (!input) throw new Error("input not rendered");
  input.value = value;
  input.focus();
  input.setSelectionRange(caret, caret);
  return input;
}

it("adds the punctuation while typing at the end", () => {
  const input = focusedInput("010010", 6);

  maskInput(input, formatCep);

  expect(input.value).toBe("01001-0");
  expect(input.selectionStart).toBe(7);
});

it("keeps the caret after the same digit when editing in the middle", () => {
  // "01001-000" with a "9" typed after the second digit.
  const input = focusedInput("019001-000", 3);

  maskInput(input, formatCep);

  expect(input.value).toBe("01900-100");
  expect(input.selectionStart).toBe(3);
});
