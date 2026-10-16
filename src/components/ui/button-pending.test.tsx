import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { Button } from "./button";
import { SubmitButton } from "./submit-button";

afterEach(cleanup);

it("disables the button, marks it busy and swaps the label while pending", () => {
  render(
    <Button pending pendingLabel="Salvando…">
      Salvar
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Salvando…" });

  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
});

it("renders the normal label and state when idle", () => {
  render(<Button pendingLabel="Salvando…">Salvar</Button>);
  const button = screen.getByRole("button", { name: "Salvar" });

  expect(button).toBeEnabled();
  expect(button).not.toHaveAttribute("aria-busy");
});

it("SubmitButton follows the status of its form action", async () => {
  let finish: () => void = () => undefined;
  const action = () => new Promise<void>((resolve) => (finish = resolve));
  render(
    <form action={action}>
      <SubmitButton pendingLabel="Enviando…">Enviar</SubmitButton>
    </form>,
  );

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enviar" })));
  expect(await screen.findByRole("button", { name: "Enviando…" })).toBeDisabled();

  await act(async () => finish());
  expect(await screen.findByRole("button", { name: "Enviar" })).toBeEnabled();
});
