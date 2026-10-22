"use client";

import { useActionState } from "react";

export const NETWORK_ERROR_MESSAGE = "Não foi possível conectar. Verifique sua conexão e tente novamente.";

/**
 * A Server Action that never reached the server (offline, dropped mobile connection) rejects with
 * the browser's `TypeError: Failed to fetch`. Anything else is a real error and keeps propagating.
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

type StateWithError = { error?: string | null | undefined };

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
      return { ...state, ...(values ? { values } : {}), success: undefined, error: NETWORK_ERROR_MESSAGE };
    }
  };
}

/**
 * `useActionState` for Server Actions: same signature and return, but a dropped connection shows
 * the inline error of the form (its `state.error`) and keeps what the person typed.
 */
export function useServerActionState<State extends StateWithError, Payload = FormData>(
  action: (state: State, payload: Payload) => State | Promise<State>,
  initialState: State,
): [state: State, dispatch: (payload: Payload) => void, isPending: boolean] {
  return useActionState<State, Payload>(withNetworkErrorState(action), initialState as FormState<State>);
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
