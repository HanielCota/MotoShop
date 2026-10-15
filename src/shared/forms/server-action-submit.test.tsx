import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { callServerAction, useServerActionState, withNetworkErrorState } from "./server-action-submit";

afterEach(cleanup);

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

describe("withNetworkErrorState", () => {
  it("keeps the previous state and adds the connection error when the request fails", async () => {
    const action = withNetworkErrorState<{ values?: { code: string }; error?: string }, FormData>(offline);

    await expect(action({ values: { code: "MOTO10" } }, new FormData())).resolves.toEqual({
      values: { code: "MOTO10" },
      error: expect.stringContaining("Não foi possível conectar"),
    });
  });

  it("lets server errors reach the error boundary", async () => {
    const action = withNetworkErrorState<{ error?: string }, FormData>(() =>
      Promise.reject(new Error("database down")),
    );

    await expect(action({}, new FormData())).rejects.toThrow("database down");
  });
});

describe("callServerAction", () => {
  it("returns the action result", async () => {
    await expect(callServerAction(async () => ({ success: "Salvo." }))).resolves.toEqual({ success: "Salvo." });
  });

  it("turns a dropped connection into { error }", async () => {
    await expect(callServerAction(offline)).resolves.toEqual({ error: expect.stringContaining("conexão") });
  });
});

function Form({ action }: { action: (state: { error?: string }, formData: FormData) => Promise<{ error?: string }> }) {
  const [state, formAction, pending] = useServerActionState(action, {});
  return (
    <form action={formAction}>
      <input name="code" defaultValue="MOTO10" />
      <button disabled={pending}>Salvar</button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

it("useServerActionState shows the connection error inline", async () => {
  render(<Form action={vi.fn(offline)} />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
  expect(screen.getByRole("textbox")).toBeInTheDocument();
});
