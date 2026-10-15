import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const requestDisputeAction = vi.hoisted(() => vi.fn());
vi.mock("../actions/dispute-actions", () => ({ requestDisputeAction }));

import { RequestDisputeForm } from "./request-dispute-form";

afterEach(cleanup);

it("asks for a longer description inline without calling the server", () => {
  render(<RequestDisputeForm orderNumber="MS-1" sellerOrderId="so-1" />);

  fireEvent.change(screen.getByRole("textbox", { name: "Descrição do problema" }), { target: { value: "curto" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar para mediação" }));

  expect(screen.getByRole("alert")).toHaveTextContent("pelo menos 10 caracteres");
  expect(requestDisputeAction).not.toHaveBeenCalled();
});
