import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../actions/notification-preference-actions", () => ({ updateNotificationPreferencesAction: mocks.update }));

import { NotificationPreferencesForm } from "./notification-preferences-form";

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it("saves the preference as soon as it is unchecked, without a save button", async () => {
  mocks.update.mockResolvedValue({ success: "Preferências atualizadas." });
  render(<NotificationPreferencesForm emailOrderUpdatesEnabled />);

  expect(screen.queryByRole("button", { name: /Salvar/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));

  expect(await screen.findByRole("status")).toHaveTextContent("Preferências atualizadas.");
  const sent = mocks.update.mock.calls[0]?.[1] as FormData;
  expect(sent.get("emailOrderUpdatesEnabled")).toBeNull();
});

it("puts the checkbox back when saving fails", async () => {
  mocks.update.mockResolvedValue({ error: "Não foi possível salvar agora." });
  render(<NotificationPreferencesForm emailOrderUpdatesEnabled />);

  fireEvent.click(screen.getByRole("checkbox"));

  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar agora.");
  await waitFor(() => expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true"));
});
