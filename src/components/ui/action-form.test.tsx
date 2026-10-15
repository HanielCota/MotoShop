import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ActionForm } from "./action-form";

afterEach(cleanup);

function renderForm(action: (formData: FormData) => unknown) {
  render(
    <ActionForm action={action}>
      <input name="sellerId" defaultValue="seller-1" />
      <button>Aprovar</button>
    </ActionForm>,
  );
  return act(async () => fireEvent.click(screen.getByRole("button", { name: "Aprovar" })));
}

it("submits the form data to the action", async () => {
  const action = vi.fn(async () => undefined);

  await renderForm(action);

  expect(action).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows a connection error inline instead of breaking the page", async () => {
  await renderForm(() => Promise.reject(new TypeError("Failed to fetch")));

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
  expect(screen.getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
});
