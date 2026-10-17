import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  default: ({ sizes }: { sizes?: string }) => <span data-testid="suggestion-image" data-sizes={sizes} />,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { ProductSearchCombobox } from "./product-search-combobox";

const suggestions = [
  {
    id: "p1",
    name: "Capacete Apex",
    href: "/products/capacete-apex",
    imageUrl: "/a.webp",
    priceInCents: 89990,
  },
  { id: "p2", name: "Capacete Kid", href: "/products/capacete-kid", imageUrl: null, priceInCents: 49990 },
];
const fetchMock = vi.fn();

function renderSearch() {
  const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <label htmlFor="search">Buscar produtos</label>
      <ProductSearchCombobox id="search" placeholder="Buscar" />
    </form>,
  );
  return { input: screen.getByRole("combobox", { name: "Buscar produtos" }), onSubmit };
}

async function typeAndWaitForSuggestions(input: HTMLElement, text: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  await screen.findByRole("option", { name: /Capacete Apex/ });
}

beforeEach(() => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ suggestions }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  navigation.push.mockReset();
});

describe("ProductSearchCombobox", () => {
  it("does not ask for suggestions below two characters", async () => {
    const { input } = renderSearch();

    fireEvent.change(input, { target: { value: "c" } });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("does not ask for suggestions for a query longer than the endpoint accepts", async () => {
    const { input } = renderSearch();

    fireEvent.change(input, { target: { value: "a".repeat(81) } });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("lists suggestions with name and price, without any demo mark", async () => {
    const { input } = renderSearch();

    await typeAndWaitForSuggestions(input, "capa");

    expect(fetchMock).toHaveBeenCalledWith("/api/search/suggestions?q=capa", expect.anything());
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: /Capacete Apex.*899,90/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Capacete Kid.*499,90/ })).toBeInTheDocument();
    expect(screen.queryByText(/demonstração/)).not.toBeInTheDocument();
  });

  it("shows suggestion thumbnails about 20% bigger than before: 58px instead of 48px", async () => {
    const { input } = renderSearch();

    await typeAndWaitForSuggestions(input, "capa");

    const image = within(screen.getByRole("option", { name: /Capacete Apex/ })).getByTestId("suggestion-image");
    expect(image).toHaveAttribute("data-sizes", "58px");
    expect(image.parentElement).toHaveClass("size-14.5");
    expect(image.parentElement).not.toHaveClass("size-12");
  });

  it("moves through suggestions with the arrows and opens the highlighted one on Enter", async () => {
    const { input, onSubmit } = renderSearch();
    await typeAndWaitForSuggestions(input, "capa");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const second = screen.getByRole("option", { name: /Capacete Kid/ });
    expect(input).toHaveAttribute("aria-activedescendant", second.id);
    expect(second).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigation.push).toHaveBeenCalledWith("/products/capacete-kid");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("keeps the full search on Enter when no suggestion is highlighted", async () => {
    const { input } = renderSearch();
    await typeAndWaitForSuggestions(input, "capa");

    const event = fireEvent.keyDown(input, { key: "Enter" });

    expect(event).toBe(true);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("closes the list on Escape", async () => {
    const { input } = renderSearch();
    await typeAndWaitForSuggestions(input, "capa");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(input).toHaveAttribute("aria-expanded", "false");
  });
});
