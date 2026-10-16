import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DesignSelect } from "./design-select";

afterEach(cleanup);

it("opens the select list on the shared popover surface and layer", () => {
  render(
    <DesignSelect aria-label="Categoria" defaultValue="">
      <option value="">Todas</option>
    </DesignSelect>,
  );

  fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
  const popup = screen.getByRole("listbox").parentElement;

  expect(popup).toHaveClass("bg-popover", "rounded-xl", "shadow-lg");
  expect(popup?.closest(".z-popover")).not.toBeNull();
});
