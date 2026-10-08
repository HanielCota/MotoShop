import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DesignCheckbox } from "./design-checkbox";
import { DesignRadio, DesignRadioGroup } from "./design-radio";

afterEach(cleanup);

describe("design choice controls", () => {
  it("submits a checked checkbox and leaves an unchecked one out of FormData", () => {
    const { container } = render(
      <form>
        <label>
          Atualizações por e-mail
          <DesignCheckbox name="emailOrderUpdatesEnabled" />
        </label>
      </form>,
    );
    const form = container.querySelector("form")!;
    expect(new FormData(form).has("emailOrderUpdatesEnabled")).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: /Atualizações por e-mail/ }));
    expect(new FormData(form).get("emailOrderUpdatesEnabled")).toBe("on");
  });

  it("switches payment choice without submitting both options", () => {
    const { container } = render(
      <form>
        <DesignRadioGroup name="paymentType" label="Pagamento" value="pix" onValueChange={() => {}}>
          <label>
            <DesignRadio value="pix" /> Pix
          </label>
          <label>
            <DesignRadio value="card" disabled /> Cartão
          </label>
        </DesignRadioGroup>
      </form>,
    );
    const form = container.querySelector("form")!;
    expect(new FormData(form).getAll("paymentType")).toEqual(["pix"]);
    expect(screen.getByRole("radio", { name: /Cartão/ })).toHaveAttribute("aria-disabled", "true");
  });
});
