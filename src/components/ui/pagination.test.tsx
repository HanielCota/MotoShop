import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { Pagination } from "./pagination";

afterEach(cleanup);

describe("Pagination", () => {
  it("shows only valid directions while preserving provided URLs", () => {
    const { rerender } = render(
      <Pagination
        ariaLabel="Paginação de pedidos"
        page={1}
        pageCount={3}
        previousHref="/orders?page=0"
        nextHref="/orders?page=2"
      />,
    );
    expect(screen.queryByRole("link", { name: "Anterior" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute("href", "/orders?page=2");

    rerender(
      <Pagination
        ariaLabel="Paginação de pedidos"
        page={3}
        pageCount={3}
        previousHref="/orders?page=2"
        nextHref="/orders?page=4"
      />,
    );
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute("href", "/orders?page=2");
    expect(screen.queryByRole("link", { name: "Próxima" })).not.toBeInTheDocument();
  });

  it("omits navigation for a single page", () => {
    render(<Pagination ariaLabel="Paginação de produtos" page={1} pageCount={1} />);
    expect(screen.queryByRole("navigation", { name: "Paginação de produtos" })).not.toBeInTheDocument();
  });
});
