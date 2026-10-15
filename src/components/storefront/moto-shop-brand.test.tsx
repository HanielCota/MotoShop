import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { MotoShopBrand } from "./moto-shop-brand";

afterEach(cleanup);

function logos(container: HTMLElement) {
  const [primary, alternate] = Array.from(container.querySelectorAll("img"));
  if (!primary || !alternate) throw new Error("Expected the primary and alternate logos");
  return { primary, alternate };
}

it.each(["header", "auth", "footer"] as const)(
  "loads the %s primary logo eagerly and the hover logo lazily",
  (variant) => {
    const { container } = render(<MotoShopBrand variant={variant} />);
    const { primary, alternate } = logos(container);

    expect(primary).toHaveAttribute("loading", "eager");
    expect(alternate).toHaveAttribute("loading", "lazy");
  },
);

it("raises the fetch priority only where the logo leads the page", () => {
  const header = logos(render(<MotoShopBrand variant="header" />).container);
  expect(header.primary).toHaveAttribute("fetchpriority", "high");
  cleanup();

  const footer = logos(render(<MotoShopBrand variant="footer" />).container);
  expect(footer.primary).toHaveAttribute("fetchpriority", "auto");
});
