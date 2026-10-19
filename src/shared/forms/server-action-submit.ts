"use client";

import { useActionState, useCallback, useEffect, useRef } from "react";

import { highlightInvalidField } from "./field-error-focus";
import { trackFormSubmits, lastSubmittedForm } from "./submitted-form";

export const NETWORK_ERROR_MESSAGE = "Não foi possível conectar. Verifique sua conexão e tente novamente.";

/**
 * A Server Action that never reached the server (offline, dropped mobile connection) rejects with
 * the browser's `TypeError: Failed to fetch`. Anything else is a real error and keeps propagating.
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/** `field` names the control (its `name`) that the error is about, so the form can point at it. */
type StateWithError = { error?: string | null | undefined; field?: string | undefined };

// Form states are plain objects, never promises, so `Awaited<State>` (what React stores) is `State`.
type FormState<State> = Awaited<State> & State;

/** Wraps a `useActionState` action so a network failure becomes `{ ...state, error }` instead of the error boundary. */
export function withNetworkErrorState<State extends StateWithError, Payload>(
  action: (state: State, payload: Payload) => State | Promise<State>,
): (state: State, payload: Payload) => Promise<State> {
  return async (state, payload) => {
    try {
      return await action(state, payload);
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      // React resets uncontrolled inputs when the action resolves, even with an error state.
      // Keep this submission's text values so forms can restore their defaultValue fields.
      const values =
        payload instanceof FormData
          ? Object.fromEntries([...payload.entries()].filter((entry) => typeof entry[1] === "string"))
          : undefined;
      // A connection error is about no field, so the previous result's field is dropped.
      return {
        ...state,
        ...(values ? { values } : {}),
        success: undefined,
        field: undefined,
        error: NETWORK_ERROR_MESSAGE,
      };
    }
  };
}

/**
 * `useActionState` for Server Actions: same signature and return, but a dropped connection shows
 * the inline error of the form (its `state.error`) and keeps what the person typed. When the
 * result has an error, the wrong field of the submitted form flashes and receives focus.
 */
export function useServerActionState<State extends StateWithError, Payload = FormData>(
  action: (state: State, payload: Payload) => State | Promise<State>,
  initialState: State,
): [state: State, dispatch: (payload: Payload) => void, isPending: boolean] {
  const [state, dispatch, isPending] = useActionState<State, Payload>(
    withNetworkErrorState(action),
    initialState as FormState<State>,
  );
  const submittedForm = useRef<HTMLFormElement | null>(null);

  useEffect(trackFormSubmits, []);

  // Runs after the result rendered, so fields it marked are already `aria-invalid`.
  useEffect(() => {
    const form = submittedForm.current;
    submittedForm.current = null;
    if (form == null || !form.isConnected || !state.error) return;

    highlightInvalidField(form, state.field);
  }, [state]);

  const dispatchFromForm = useCallback(
    (payload: Payload) => {
      submittedForm.current = lastSubmittedForm();
      dispatch(payload);
    },
    [dispatch],
  );

  return [state, dispatchFromForm, isPending];
}

/**
 * For actions called directly (`await someAction(...)` in a handler or transition): resolves to the
 * action result, or to `{ error }` when the request never reached the server.
 */
export async function callServerAction<Result extends object>(
  call: () => Promise<Result>,
): Promise<Result | (Partial<Result> & { error: string })> {
  try {
    return await call();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    // Every field of the result is optional in the fallback, so an object with only `error` fits it.
    return { error: NETWORK_ERROR_MESSAGE } as Partial<Result> & { error: string };
  }
}
