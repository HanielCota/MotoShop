import { afterEach, expect, it, vi } from "vitest";

import { highlightInvalidField, problemField } from "./field-error-focus";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function renderForm(html: string) {
  document.body.innerHTML = `<form>${html}</form>`;
  const form = document.querySelector("form");
  if (!form) throw new Error("form not rendered");
  return form;
}

it("marks, flashes and focuses the named field, and clears the mark when it is edited", () => {
  vi.useFakeTimers();
  const form = renderForm('<input name="code" /><input name="discountPercent" />');
  const code = form.querySelector<HTMLInputElement>("[name=code]");

  expect(highlightInvalidField(form, "code")).toBe(true);
  expect(document.activeElement).toBe(code);
  expect(code).toHaveAttribute("aria-invalid", "true");
  expect(code).toHaveAttribute("data-error-flash");

  vi.advanceTimersByTime(700);
  expect(code).not.toHaveAttribute("data-error-flash");

  code?.dispatchEvent(new Event("input", { bubbles: true }));
  expect(code).not.toHaveAttribute("aria-invalid");
});

it("falls back to the first field the form already marked invalid", () => {
  const form = renderForm('<input name="label" /><input name="street" aria-invalid="true" />');

  expect(highlightInvalidField(form, "missing")).toBe(true);
  expect(document.activeElement).toBe(form.querySelector("[name=street]"));
});

it("focuses the visible control of a custom select instead of its hidden input", () => {
  const form = renderForm(
    '<div data-slot="form-field"><button type="button" role="combobox">Tipo</button><input type="hidden" name="discountType" /></div>',
  );

  highlightInvalidField(form, "discountType");
  expect(document.activeElement).toBe(form.querySelector("[role=combobox]"));
});

it("leaves focus alone when no field is known", () => {
  const form = renderForm('<input name="code" /><button type="submit">Criar</button>');
  const button = form.querySelector("button");
  button?.focus();

  expect(highlightInvalidField(form)).toBe(false);
  expect(document.activeElement).toBe(button);
});

it("reads the field only from problems that carry one", () => {
  expect(problemField({ message: "Informe o código.", field: "code" })).toBe("code");
  expect(problemField("Informe o código.")).toBeUndefined();
  expect(problemField({ error: "Informe o nome." })).toBeUndefined();
});
