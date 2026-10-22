import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { callServerAction, useServerActionState, withNetworkErrorState } from "./server-action-submit";

afterEach(cleanup);

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

describe("withNetworkErrorState", () => {
  it("keeps the current submission's values and clears stale success when the request fails", async () => {
    const action = withNetworkErrorState<{ values?: { code: string }; error?: string }, FormData>(offline);
    const formData = new FormData();
    formData.set("code", "MOTO20");

    await expect(action({ values: { code: "MOTO10" } }, formData)).resolves.toEqual({
      values: { code: "MOTO20" },
      error: expect.stringContaining("Não foi possível conectar"),
    });
  });

  it("drops the field of the previous error, since a connection error is about no field", async () => {
    const action = withNetworkErrorState<{ error?: string; field?: string }, FormData>(offline);

    const state = await action({ error: "Código em uso.", field: "code" }, new FormData());
    expect(state.field).toBeUndefined();
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

type FieldState = { error?: string; field?: string };

function Form({ action }: { action: (state: FieldState, formData: FormData) => Promise<FieldState> }) {
  const [state, formAction, pending] = useServerActionState(action, {});
  return (
    <form action={formAction}>
      <input name="code" defaultValue="MOTO10" />
      <input name="discountPercent" defaultValue="10" />
      <button disabled={pending}>Salvar</button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

it("useServerActionState shows the connection error inline", async () => {
  render(<Form action={vi.fn(offline)} />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
});

it("useServerActionState flashes and focuses the field named by the server error", async () => {
  render(<Form action={vi.fn(async () => ({ error: "Esse código não está disponível.", field: "code" }))} />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));

  expect(await screen.findByRole("alert")).toHaveTextContent("Esse código não está disponível.");
  const code = screen.getAllByRole("textbox")[0];
  expect(code).toHaveFocus();
  expect(code).toHaveAttribute("aria-invalid", "true");
  expect(code).toHaveAttribute("data-error-flash");
});
