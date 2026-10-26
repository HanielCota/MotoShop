import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductCardData } from "@/components/storefront/product-card";

import { MarketingHome } from "./marketing-home";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next/image", () => ({
  // Image optimization is covered by Next.js; these tests exercise the page UI.
  default: (props: { src: string; alt: string; loading?: "eager" | "lazy"; "aria-hidden"?: "true" }) => (
    <div
      role="img"
      aria-label={props.alt}
      aria-hidden={props["aria-hidden"]}
      data-src={props.src}
      data-loading={props.loading}
    />
  ),
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

function makeProduct(id: string, name: string, overrides: Partial<ProductCardData> = {}): ProductCardData {
  return {
    id,
    name,
    href: `/products/${id}`,
    imageUrl: `/${id}.webp`,
    imageAlt: name,
    category: { label: "Capacetes" },
    seller: { name: "Loja de teste" },
    priceInCents: 89990,
    hasPriceRange: false,
    availableQuantity: 3,
    sponsored: false,
    isNew: false,
    ...overrides,
  };
}

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
  it.each([
    ["a visitor", {}],
    ["a customer with a saved motorcycle", { primaryFitmentId: "honda-2025" }],
  ])("opens on 'Buscar produto', on the left, with 'Peças por moto' on the right, for %s", (_who, options) => {
    renderHome("", options);

    const tabs = within(screen.getByRole("group", { name: "Forma de busca" })).getAllByRole("button");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Buscar produto", "Peças por moto"]);
    expect(tabs[0]).toHaveAttribute("aria-pressed", "true");
    expect(tabs[1]).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Ver peças" })).not.toBeInTheDocument();
  });

  it("opens on 'Peças por moto' and restores the fields when the URL already has a motorcycle", async () => {
    renderHome("?moto=yamaha-2025");
    expect(screen.getByRole("button", { name: "Peças por moto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Yamaha");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("YZ250F");
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2025 · 250 cc");
    fireEvent.click(screen.getByRole("button", { name: "Ver peças" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/products?moto=yamaha-2025"));
  });

  it("starts with the saved primary motorcycle while an explicit URL selection takes priority", () => {
    renderHome("", { primaryFitmentId: "yamaha-2025" });
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Yamaha");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("YZ250F");
    cleanup();
    renderHome("?moto=honda-2024", { primaryFitmentId: "yamaha-2025" });
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2024 · R · 250 cc");
  });

  it("starts empty for a visitor and unlocks model and year one at a time", () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Selecione o fabricante");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveAttribute("data-disabled");
    expect(screen.getByRole("button", { name: "Ver peças" })).toBeDisabled();
  });

  it("does not pick a model or year on its own when the manufacturer has several", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    choose("Fabricante", "Yamaha");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("Selecione o modelo");
    expect(screen.getByRole("button", { name: "Ver peças" })).toBeDisabled();

    choose("Modelo", "YZ250F");
    // YZ250F has a single year, the only possible answer.
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2025 · 250 cc");
    fireEvent.click(screen.getByRole("button", { name: "Ver peças" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/products?moto=yamaha-2025"));
  });

  it("updates the model without retaining another model's fitment", () => {
    renderHome("?moto=yamaha-2025");
    choose("Modelo", "YZ450F");
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("450 cc");
    expect(screen.getByRole("combobox", { name: "Modelo" })).toHaveTextContent("YZ450F");
  });

  it("distinguishes versions in the same year and preserves selection when switching search mode", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    choose("Fabricante", "Honda");
    fireEvent.click(screen.getByRole("combobox", { name: "Ano e versão" }));
    expect(screen.getByRole("option", { name: "2025 · Special · 250 cc" })).toBeInTheDocument();
    const previousYear = screen.getByRole("option", { name: "2024 · R · 250 cc" });
    fireEvent.pointerDown(previousYear, { pointerType: "mouse" });
    fireEvent.click(previousYear);
    fireEvent.click(screen.getByRole("button", { name: "Buscar produto" }));
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    expect(screen.getByRole("combobox", { name: "Ano e versão" })).toHaveTextContent("2024 · R · 250 cc");
    fireEvent.click(screen.getByRole("button", { name: "Ver peças" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/products?moto=honda-2024"));
  });

  it("does not submit an unknown fitment from the URL", () => {
    renderHome("?moto=removed-or-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    expect(screen.getByRole("combobox", { name: "Fabricante" })).toHaveTextContent("Selecione o fabricante");
    expect(screen.getByRole("button", { name: "Ver peças" })).toBeDisabled();
  });

  it("explains an empty motorcycle list without inventing a motorcycle", () => {
    renderHome("", { fitments: [] });
    fireEvent.click(screen.getByRole("button", { name: "Peças por moto" }));
    expect(screen.getByRole("button", { name: "Ver peças" })).toBeDisabled();
    expect(screen.getByText(/A seleção de motos está indisponível/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Peças compatíveis" })).not.toBeInTheDocument();
    expect(screen.queryByText("Honda CRF 250R")).not.toBeInTheDocument();
  });

  it("leaves header and footer to the shared storefront layout", () => {
    renderHome();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("does not render a separate saved-motorcycles promotional section", () => {
    renderHome();
    expect(screen.queryByText("Minha Moto")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gerenciar motos salvas" })).not.toBeInTheDocument();
  });

  it("links directly to active equipment subcategories", () => {
    renderHome();
    const nav = screen.getByRole("navigation", { name: "Categorias de equipamentos" });
    expect(within(nav).getByRole("link", { name: "Botas" })).toHaveAttribute("href", "/categoria/equipment-boots");
    expect(within(nav).queryByRole("link", { name: "Óculos de proteção" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Freios Pastilhas/ })).not.toBeInTheDocument();
  });

  it("shows each category card's product photo as decoration, hidden from screen readers", () => {
    renderHome();
    const grid = document.getElementById("categorias");
    const photos = [...(grid?.querySelectorAll("[data-src^='/images/home/categories/']") ?? [])];

    expect(photos.map((photo) => photo.getAttribute("data-src"))).toEqual([
      "/images/home/categories/pecas.webp",
      "/images/home/categories/capacetes.webp",
      "/images/home/categories/equipamentos.webp",
    ]);
    for (const photo of photos) {
      expect(photo).toHaveAttribute("aria-label", "");
      expect(photo).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByRole("link", { name: /Peças para sua moto/i })).toHaveAccessibleName(/^Manutenção/);
  });

  it("does not promise pickup or unfiltered universal equipment", () => {
    renderHome();
    expect(screen.queryByText("Entrega ou retirada")).not.toBeInTheDocument();
    expect(screen.queryByText(/sem esconder equipamentos universais/)).not.toBeInTheDocument();
    expect(screen.queryByText("Ver opções")).not.toBeInTheDocument();
  });

  it("shows a truthful empty state before approved products exist", () => {
    renderHome();
    expect(screen.getByText(/preparando a primeira seleção/)).toBeInTheDocument();
    expect(screen.queryByText("Demonstração")).not.toBeInTheDocument();
  });

  it("shows featured products before the categories on phones and keeps the order from md up", () => {
    renderHome("", { featuredProducts: [makeProduct("capacete", "Capacete")] });
    const featured = document.querySelector(`[aria-labelledby="featured-products-title"]`)?.parentElement;
    const categories = document.querySelector(`[aria-labelledby="home-categories-title"]`)?.parentElement;

    expect(featured).toHaveClass("order-1", "md:order-2");
    expect(categories).toHaveClass("order-2", "md:order-1");
  });

  it("links approved featured products to their details without invented installments", () => {
    renderHome("", {
      featuredProducts: [
        makeProduct("capacete-aprovado", "Capacete aprovado", { imageUrl: null, seller: { name: "Loja A" } }),
      ],
    });
    expect(screen.getByRole("link", { name: "Ver Capacete aprovado" })).toHaveAttribute(
      "href",
      "/products/capacete-aprovado",
    );
    expect(screen.getByText("Loja A")).toBeInTheDocument();
    expect(screen.getByText("R$ 899,90")).toBeInTheDocument();
    expect(screen.queryByText(/10x de/)).not.toBeInTheDocument();
  });

  it("marks sponsored and promotional offers with the shared product card", () => {
    renderHome("", {
      featuredProducts: [
        makeProduct("capacete-vip", "Capacete VIP", { sponsored: true, compareAtPriceInCents: 99990 }),
      ],
    });
    expect(screen.getByText("Patrocinado · Loja VIP")).toBeInTheDocument();
    expect(screen.getByText("Oferta")).toBeInTheDocument();
    expect(screen.getByText("R$ 999,90")).toHaveClass("line-through");
  });

  it("loads eagerly only the featured images of the first screen", () => {
    renderHome("", {
      featuredProducts: ["a", "b", "c", "d", "e"].map((suffix) =>
        makeProduct(`capacete-${suffix}`, `Capacete ${suffix}`),
      ),
    });

    expect(screen.getByRole("img", { name: "Capacete a" })).toHaveAttribute("data-loading", "eager");
    expect(screen.getByRole("img", { name: "Capacete d" })).toHaveAttribute("data-loading", "eager");
    expect(screen.getByRole("img", { name: "Capacete e" })).toHaveAttribute("data-loading", "lazy");
  });

  it("shows the production assurances and never announces that purchases are coming soon", () => {
    renderHome();
    const assurances = screen.getByRole("list", { name: "Garantias do Moto Shop" });
    expect(within(assurances).getByText("Compre sem criar conta")).toBeInTheDocument();
    expect(within(assurances).getByText("Frete e prazo de cada loja no checkout")).toBeInTheDocument();
    expect(within(assurances).queryByText("Compras em breve")).not.toBeInTheDocument();
  });
});
