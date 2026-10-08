import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
import PageError from "./error";
afterEach(cleanup);
it("offers recovery without displaying internal errors", () => {
  const retry = vi.fn();
  render(<PageError error={new Error("internal-sensitive-diagnostic")} retry={retry} />);
  expect(screen.queryByText("internal-sensitive-diagnostic")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Consultar meus pedidos" })).toHaveAttribute("href", "/orders");
});
