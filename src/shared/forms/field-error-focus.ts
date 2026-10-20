"use client";

/** A validation problem that names the form control it belongs to (its `name` attribute). */
export type FieldProblem = { message: string; field?: string | undefined };

const FLASH_ATTRIBUTE = "data-error-flash";
const MARKED_ATTRIBUTE = "data-error-marked";
// Slightly longer than the CSS animation, so the attribute is gone even when `animationend` never fires.
const FLASH_DURATION_MS = 700;
const FOCUSABLE_CONTROL = "input:not([type=hidden]), textarea, select, button, [role=combobox]";
/** The running flash timer of each control; weak, so removed fields are not kept alive. */
const flashTimers = new WeakMap<HTMLElement, number>();

/** The field named by a validation problem, when the problem is an object that carries one. */
export function problemField(problem: unknown): string | undefined {
  if (typeof problem !== "object" || problem === null || !("field" in problem)) return undefined;
  return typeof problem.field === "string" ? problem.field : undefined;
}

/**
 * After a failed submit: the wrong field turns red, flashes briefly and receives focus, while the
 * form notice stays next to the button. Without a known field, the first control already marked
 * `aria-invalid` is used. Returns `false` when there is no field to point at.
 */
export function highlightInvalidField(form: HTMLFormElement, fieldName?: string): boolean {
  const control = (fieldName ? namedControl(form, fieldName) : null) ?? firstInvalidControl(form);
  if (!control) return false;

  highlightControl(control);
  return true;
}

/** Marks one control as invalid, flashes it (skipped with reduced motion, in CSS) and focuses it. */
export function highlightControl(control: HTMLElement) {
  if (control.getAttribute("aria-invalid") !== "true") {
    control.setAttribute("aria-invalid", "true");
    control.setAttribute(MARKED_ATTRIBUTE, "");
    clearMarkOnEdit(control);
  }

  flash(control);
  control.focus();
}

function namedControl(form: HTMLFormElement, name: string): HTMLElement | null {
  const item = form.elements.namedItem(name);
  const element = item instanceof RadioNodeList ? item[0] : item;
  if (!(element instanceof HTMLElement)) return null;
  if (!(element instanceof HTMLInputElement) || element.type !== "hidden") return element;

  // Custom selects keep the value in a hidden input; the visible control lives in the same field.
  return element.closest("[data-slot=form-field]")?.querySelector<HTMLElement>(FOCUSABLE_CONTROL) ?? null;
}

function firstInvalidControl(form: HTMLFormElement): HTMLElement | null {
  return form.querySelector<HTMLElement>('[aria-invalid="true"]');
}

function flash(control: HTMLElement) {
  // A repeated submit restarts the flash; the timer of the previous one must not end it early.
  const pending = flashTimers.get(control);
  if (pending !== undefined) window.clearTimeout(pending);

  // Removing and re-adding the attribute restarts the animation.
  control.removeAttribute(FLASH_ATTRIBUTE);
  void control.offsetWidth;
  control.setAttribute(FLASH_ATTRIBUTE, "");
  const timer = window.setTimeout(() => {
    control.removeAttribute(FLASH_ATTRIBUTE);
    flashTimers.delete(control);
  }, FLASH_DURATION_MS);
  flashTimers.set(control, timer);
}

/** The red border set here (not by React) goes away as soon as the person edits the field. */
function clearMarkOnEdit(control: HTMLElement) {
  const container = control.closest("[data-slot=form-field]") ?? control;
  const clear = () => {
    if (control.hasAttribute(MARKED_ATTRIBUTE)) control.removeAttribute("aria-invalid");
    control.removeAttribute(MARKED_ATTRIBUTE);
    container.removeEventListener("input", clear);
    container.removeEventListener("change", clear);
  };
  container.addEventListener("input", clear);
  container.addEventListener("change", clear);
}
