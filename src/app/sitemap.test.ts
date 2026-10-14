import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ products: vi.fn(), empty: vi.fn() }));
vi.mock("@/config/get-application-base-url", () => ({ getApplicationBaseUrl: () => "https://motoshopbrasil.com.br" }));
vi.mock("@/lib/database", () => ({
  db: {
    product: { findMany: mocks.products },
    category: { findMany: mocks.empty },
    brand: { findMany: mocks.empty },
    store: { findMany: mocks.empty },
    motorcycleFitment: { findMany: mocks.empty },
  },
}));

import sitemap from "./sitemap";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.products.mockResolvedValue([{ slug: "capacete", updatedAt: new Date("2026-10-01") }]);
  mocks.empty.mockResolvedValue([]);
});

it("lists only products the product page would show, capped at the sitemap limit (L-04)", async () => {
  const entries = await sitemap();

  expect(mocks.products).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: "APPROVED",
        isDemo: false,
        category: { active: true },
        brand: { active: true },
        seller: { status: { in: ["APPROVED", "ACTIVE"] } },
      },
      take: 45_000,
    }),
  );
  expect(entries.map((entry) => entry.url)).toContain("https://motoshopbrasil.com.br/products/capacete");
});
