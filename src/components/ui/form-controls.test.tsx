import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "./input";
import { Textarea } from "./textarea";

afterEach(cleanup);

describe("shared form controls", () => {
  it("preserves native input attributes and form values", () => {
    const { container } = render(
      <form>
        <label htmlFor="amount">Quantidade</label>
        <Input id="amount" name="amount" type="number" min={1} defaultValue={2} aria-invalid="true" />
      </form>,
    );

    expect(screen.getByRole("spinbutton", { name: "Quantidade" })).toHaveAttribute("aria-invalid", "true");
    expect(new FormData(defined(container.querySelector("form"))).get("amount")).toBe("2");
  });

  it("preserves textarea constraints and disabled state", () => {
    render(<Textarea aria-label="Observação" maxLength={100} disabled defaultValue="Teste" />);
    expect(screen.getByRole("textbox", { name: "Observação" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Observação" })).toHaveAttribute("maxlength", "100");
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
