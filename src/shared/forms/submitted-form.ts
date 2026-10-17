"use client";

/*
 * React hands a form action only the FormData, not the form. A capture listener on the document
 * sees every submit before React does, so the action can still tell which form was sent. Safari
 * does not focus the clicked button, so `document.activeElement` is not reliable for this.
 */
let submittedForm: HTMLFormElement | null = null;
let listeners = 0;

function rememberSubmit(event: Event) {
  if (!(event.target instanceof HTMLFormElement)) return;
  const form = event.target;
  submittedForm = form;
  // Only the action dispatched by this submit (same task) may use it.
  window.setTimeout(() => {
    if (submittedForm === form) submittedForm = null;
  }, 0);
}

/** Effect callback: listens for submits while at least one form hook is mounted. */
export function trackFormSubmits() {
  if (listeners === 0) document.addEventListener("submit", rememberSubmit, true);
  listeners += 1;

  return () => {
    listeners -= 1;
    if (listeners === 0) document.removeEventListener("submit", rememberSubmit, true);
  };
}

/** The form whose submit is being handled right now, or `null` for a programmatic dispatch. */
export function lastSubmittedForm(): HTMLFormElement | null {
  return submittedForm;
}
