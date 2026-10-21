import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/database", () => ({ db: { productVariant: { findMany: mocks.findMany } } }));

import { buildVariantAttributeWhere, listPublicVariantAttributeOptions } from "./variant-attribute-options";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany
    .mockResolvedValueOnce([{ color: "Azul" }, { color: "Preto" }])
    .mockResolvedValueOnce([{ size: "40" }, { size: "M" }]);
});

it("lists only colors and sizes used by public variants, without querying genders", async () => {
  expect(await listPublicVariantAttributeOptions()).toEqual({
    colors: ["Azul", "Preto"],
    sizes: ["40", "M"],
  });
  expect(mocks.findMany).toHaveBeenCalledTimes(2);
  for (const [call] of mocks.findMany.mock.calls) {
    expect(call.where).toMatchObject({
      active: true,
      product: { status: "APPROVED", seller: { status: { in: ["APPROVED", "ACTIVE"] } } },
    });
  }
});

it("builds a variant filter that ignores empty fields", () => {
  expect(buildVariantAttributeWhere({})).toEqual({ active: true });
  expect(buildVariantAttributeWhere({ gender: "FEMALE", color: "preto", size: "" })).toEqual({
    active: true,
    gender: "FEMALE",
    color: { equals: "preto", mode: "insensitive" },
  });
});
