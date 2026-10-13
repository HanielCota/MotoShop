import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), logError: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
vi.mock("@/modules/products/queries/search-suggestions", () => ({ listSearchSuggestions: mocks.list }));

import { NextRequest } from "next/server";

import { GET } from "./route";

const suggestion = {
  id: "product-1",
  name: "Capacete off-road",
  href: "/products/capacete-off-road",
  imageUrl: null,
  priceInCents: 89990,
  isDemo: false,
};

function request(query: string) {
  return new NextRequest(`http://localhost/api/search/suggestions?${query}`);
}

describe("GET /api/search/suggestions", () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.logError.mockReset();
  });

  it("returns the suggestions found for a trimmed query", async () => {
    mocks.list.mockResolvedValue([suggestion]);

    const response = await GET(request("q=%20capa%20"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [suggestion] });
    expect(mocks.list).toHaveBeenCalledWith({ query: "capa", sellerId: undefined });
  });

  it("limits suggestions to one store when a seller id is given", async () => {
    mocks.list.mockResolvedValue([]);

    await GET(request("q=capa&sellerId=czrvwseller0000000000001"));

    expect(mocks.list).toHaveBeenCalledWith({ query: "capa", sellerId: "czrvwseller0000000000001" });
  });

  it.each(["q=c", "q=", "q=capa&sellerId=not%20a%20cuid"])(
    "rejects invalid input (%s) without querying",
    async (query) => {
      const response = await GET(request(query));

      expect(response.status).toBe(400);
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );

  it("logs and answers an empty list when the query fails", async () => {
    mocks.list.mockRejectedValue(new Error("database down"));

    const response = await GET(request("q=capa"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ suggestions: [] });
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ event: "search.suggestions.failed" }));
  });
});
