import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useClientValidation, type ClientFormValidator } from "./client-validation";

afterEach(cleanup);

function Form({ validate, onValid }: { validate: ClientFormValidator; onValid: () => void }) {
  const { clientError, onSubmit } = useClientValidation(validate);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        onSubmit(event);
        if (!event.defaultPrevented) onValid();
        event.preventDefault();
      }}
    >
      <input aria-label="Nome" name="name" />
      <input aria-label="Motivo" name="reason" />
      <button type="submit">Salvar</button>
      {clientError ? <p role="alert">{clientError}</p> : null}
    </form>
  );
}

it("shows the message and flashes and focuses the wrong field, on every failed submit", async () => {
  const onValid = vi.fn();
  render(<Form validate={() => ({ message: "Informe o motivo.", field: "reason" })} onValid={onValid} />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));

  expect(screen.getByRole("alert")).toHaveTextContent("Informe o motivo.");
  expect(screen.getByLabelText("Motivo")).toHaveFocus();
  expect(screen.getByLabelText("Motivo")).toHaveAttribute("data-error-flash");
  expect(onValid).not.toHaveBeenCalled();

  screen.getByRole("button", { name: "Salvar" }).focus();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));
  expect(screen.getByLabelText("Motivo")).toHaveFocus();
});

it("keeps plain text problems working and lets a valid form through", async () => {
  const onValid = vi.fn();
  const { rerender } = render(<Form validate={() => "Confira os dados."} onValid={onValid} />);

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));
  expect(screen.getByRole("alert")).toHaveTextContent("Confira os dados.");

  rerender(<Form validate={() => null} onValid={onValid} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar" })));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(onValid).toHaveBeenCalledOnce();
});
