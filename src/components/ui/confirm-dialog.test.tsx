import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { ConfirmDialog, type ConfirmDialogResult } from "./confirm-dialog";

afterEach(cleanup);

type Props = Partial<Parameters<typeof ConfirmDialog>[0]>;

function renderDialog(props: Props = {}) {
  const onConfirm = props.onConfirm ?? vi.fn(async () => undefined);
  render(
    <ConfirmDialog
      trigger={<Button variant="destructive">Remover endereço</Button>}
      title="Remover endereço?"
      description="O endereço sai da sua conta."
      confirmLabel="Remover"
      tone="destructive"
      {...props}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm };
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Remover endereço" }));
  return screen.findByRole("alertdialog", { name: "Remover endereço?" });
}

describe("ConfirmDialog", () => {
  it("opens as an alertdialog with focus on Cancelar and does not run the action", async () => {
    const { onConfirm } = renderDialog({ summary: <p>Rua A, 10</p> });

    const dialog = await openDialog();

    expect(dialog).toHaveAccessibleDescription("O endereço sai da sua conta.");
    expect(screen.getByText("Rua A, 10")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("paints the destructive confirmation as a solid red button", async () => {
    renderDialog();

    await openDialog();

    expect(screen.getByRole("button", { name: "Remover" })).toHaveClass("bg-destructive", "text-white");
  });

  it("closes on Cancelar and on ESC without running the action", async () => {
    const { onConfirm } = renderDialog();

    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    const dialog = await openDialog();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the action once confirmed and closes on success", async () => {
    const { onConfirm } = renderDialog();

    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledWith({ reason: "" });
  });

  it("shows the sending state and cannot be dismissed while the action runs", async () => {
    let finish: (result: ConfirmDialogResult) => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<ConfirmDialogResult>((resolve) => (finish = resolve)));
    renderDialog({ onConfirm, pendingLabel: "Removendo..." });

    const dialog = await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(await screen.findByRole("button", { name: "Removendo..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await act(async () => finish(undefined));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open with the returned error inline", async () => {
    renderDialog({ onConfirm: vi.fn(async () => ({ error: "Endereço usado em pedido em andamento." })) });

    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Endereço usado em pedido em andamento.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover" })).toBeEnabled();
  });

  it("turns a network failure into an inline message instead of throwing", async () => {
    renderDialog({ onConfirm: vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))) });

    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("requires the reason when asked and passes it trimmed", async () => {
    const { onConfirm } = renderDialog({ reason: { label: "Motivo", required: true } });

    await openDialog();
    const reasonField = screen.getByRole("textbox", { name: "Motivo" });
    await waitFor(() => expect(reasonField).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe o motivo");
    expect(reasonField).toHaveAttribute("aria-invalid", "true");
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(reasonField, { target: { value: "  Documento inválido  " } });
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reason: "Documento inválido" }));
  });

  it("marks an optional reason and accepts it empty", async () => {
    const { onConfirm } = renderDialog({ reason: { label: "Motivo" } });

    await openDialog();
    expect(screen.getByText("(opcional)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reason: "" }));
  });
});
