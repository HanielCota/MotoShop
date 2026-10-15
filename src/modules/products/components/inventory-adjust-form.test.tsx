import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adjust: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/products/actions/product-actions", () => ({ adjustInventoryAction: mocks.adjust }));

import { InventoryAdjustForm } from "./inventory-adjust-form";

afterEach(cleanup);

it("does not send an empty stock adjustment to the server (BUG-011)", async () => {
  render(<InventoryAdjustForm variantId="cmf8w8m4p0000s6o5zj2q8v3k" />);

  fireEvent.click(screen.getByRole("button", { name: "Ajustar" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Informe um ajuste inteiro diferente de zero.");
  expect(mocks.adjust).not.toHaveBeenCalled();
});
