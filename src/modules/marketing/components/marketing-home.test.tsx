import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketingHome } from "./marketing-home";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  // Image optimization is covered by Next.js; these tests exercise the page UI.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const fitments = [
  { id: "honda-2025", manufacturer: "Honda", model: "CRF 250R", year: 2025, version: "R", displacementCc: 250 },
  {
    id: "honda-special",
    manufacturer: "Honda",
    model: "CRF 250R",
    year: 2025,
    version: "Special",
    displacementCc: 250,
  },
  { id: "honda-2024", manufacturer: "Honda", model: "CRF 250R", year: 2024, version: "R", displacementCc: 250 },
  { id: "yamaha-2025", manufacturer: "Yamaha", model: "YZ250F", year: 2025, version: "", displacementCc: 250 },
  { id: "yamaha-450", manufacturer: "Yamaha", model: "YZ450F", year: 2025, version: "", displacementCc: 450 },
];
const categories = [
  { id: "equipment", slug: "equipment", name: "Equipment", parentId: null },
  { id: "boots", slug: "equipment-boots", name: "Boots", parentId: "equipment" },
  { id: "helmets", slug: "equipment-helmets", name: "Helmets", parentId: "equipment" },
];

function renderHome(searchParams = "", options: Partial<ComponentProps<typeof MarketingHome>> = {}) {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} hasMemory>
      <MarketingHome fitments={fitments} categories={categories} featuredProducts={[]} {...options} />
    </NuqsTestingAdapter>,
  );
}

function choose(name: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  const item = screen.getByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item);
}

beforeEach(() => push.mockReset());
afterEach(cleanup);

describe("marketing homepage", () => {
  it("restores every field and the summary from the URL", () => {
    renderHome("?moto=yamaha-2025");
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Yamaha");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("YZ250F");
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2025 · 250 cc");
    expect(screen.getByText("Yamaha YZ250F")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Peças compatíveis" })).toHaveAttribute(
      "href",
      "/products?moto=yamaha-2025",
    );
  });

  it("starts with the saved primary motorcycle while an explicit URL selection takes priority", () => {
    const initial = renderHome("", { primaryFitmentId: "yamaha-2025" });
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Yamaha");
    expect(screen.getByRole("link", { name: "Peças compatíveis" })).toHaveAttribute(
      "href",
      "/products?moto=yamaha-2025",
    );
    initial.unmount();
    renderHome("?moto=honda-2024", { primaryFitmentId: "yamaha-2025" });
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2024 · R · 250 cc");
  });

  it("submits the selected motorcycle even immediately after a manufacturer change", async () => {
    renderHome();
    choose("Fabricante", "Yamaha");
    fireEvent.click(screen.getByRole("button", { name: "Ver peças" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/products?moto=yamaha-2025"));
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("YZ250F");
  });

  it("updates the model without retaining another model's fitment", () => {
    renderHome("?moto=yamaha-2025");
    choose("Modelo", "YZ450F");
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("450 cc");
    expect(screen.getByText("Yamaha YZ450F")).toBeInTheDocument();
  });

  it("distinguishes versions in the same year and preserves selection when switching search mode", () => {
    renderHome();
    fireEvent.click(screen.getByRole("combobox", { name: "Ano e versão" }));
    expect(screen.getByRole("option", { name: "2025 · Special · 250 cc" })).toBeInTheDocument();
    const previousYear = screen.getByRole("option", { name: "2024 · R · 250 cc" });
    fireEvent.pointerDown(previousYear, { pointerType: "mouse" });
    fireEvent.click(previousYear);
    fireEvent.click(screen.getByRole("button", { name: "Buscar produto" }));
    fireEvent.click(screen.getByRole("button", { name: "Comprar por moto" }));
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2024 · R · 250 cc");
    expect(screen.getByRole("link", { name: "Peças compatíveis" })).toHaveAttribute(
      "href",
      "/products?moto=honda-2024",
    );
  });

  it("does not submit an unknown fitment from the URL", async () => {
    renderHome("?moto=removed-or-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Ver peças" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/products?moto=honda-2025"));
  });

  it("explains an empty motorcycle list without inventing a motorcycle", () => {
    renderHome("", { fitments: [] });
    expect(screen.getByRole("button", { name: "Ver peças" })).toBeDisabled();
    expect(screen.getByText(/A seleção de motos está indisponível/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Peças compatíveis" })).not.toBeInTheDocument();
    expect(screen.queryByText("Honda CRF 250R")).not.toBeInTheDocument();
  });

  it("opens the mobile navigation, closes on Escape and returns focus", () => {
    renderHome();
    const trigger = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Navegação mobile" });
    const link = within(nav).getByRole("link", { name: "Categorias" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Navegação mobile" })).getByRole("link", { name: "Minha Moto" }),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("links directly to active equipment subcategories", () => {
    renderHome();
    const nav = screen.getByRole("navigation", { name: "Categorias de equipamentos" });
    expect(within(nav).getByRole("link", { name: "Botas" })).toHaveAttribute("href", "/categoria/equipment-boots");
    expect(within(nav).queryByRole("link", { name: "Óculos de proteção" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Freios Pastilhas/ })).not.toBeInTheDocument();
  });

  it("does not promise pickup or unfiltered universal equipment", () => {
    renderHome();
    expect(screen.queryByText("Entrega ou retirada")).not.toBeInTheDocument();
    expect(screen.queryByText(/sem esconder equipamentos universais/)).not.toBeInTheDocument();
    expect(screen.queryByText("Ver opções")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar todo o catálogo" })).toHaveAttribute("href", "/products");
  });

  it("shows a truthful empty state before approved products exist", () => {
    renderHome();
    expect(screen.getByText(/preparando a primeira seleção/)).toBeInTheDocument();
    expect(screen.queryByText("Demonstração")).not.toBeInTheDocument();
  });

  it("links approved featured products to their details without invented installments", () => {
    renderHome("", {
      featuredProducts: [
        {
          id: "product-a",
          name: "Capacete aprovado",
          category: "Capacetes",
          sellerName: "Loja A",
          price: "R$ 899,90",
          hasPriceRange: false,
          href: "/products/capacete-aprovado",
          image: null,
          imageAlt: "Capacete aprovado",
          sponsored: false,
          isDemo: false,
        },
      ],
    });
    expect(screen.getByRole("link", { name: "Ver Capacete aprovado" })).toHaveAttribute(
      "href",
      "/products/capacete-aprovado",
    );
    expect(screen.getByText("Loja A")).toBeInTheDocument();
    expect(screen.queryByText(/10x de/)).not.toBeInTheDocument();
  });
});
