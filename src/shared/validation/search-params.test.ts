import { describe, expect, it } from "vitest";
import { z } from "zod";

import { optionalTextSearchParam, parseSearchParams, searchParam } from "./search-params";

const shape = {
  kind: searchParam(z.enum(["question", "review"]), "question"),
  page: searchParam(z.coerce.number().int().min(1), 1),
  q: optionalTextSearchParam(10),
};

describe("parseSearchParams", () => {
  it("reads valid values", () => {
    expect(parseSearchParams(shape, { kind: "review", page: "3", q: " capacete " })).toEqual({
      kind: "review",
      page: 3,
      q: "capacete",
    });
  });

  it("falls back on missing, invalid or oversized values", () => {
    expect(parseSearchParams(shape, {})).toEqual({ kind: "question", page: 1, q: undefined });
    expect(parseSearchParams(shape, { kind: "__proto__", page: "-2", q: "x".repeat(11) })).toEqual({
      kind: "question",
      page: 1,
      q: undefined,
    });
    expect(parseSearchParams(shape, { page: "abc", q: "   " })).toEqual({ kind: "question", page: 1, q: undefined });
  });

  it("keeps the first value of a repeated key", () => {
    expect(parseSearchParams(shape, { kind: ["review", "question"], q: ["a", "b"] })).toMatchObject({
      kind: "review",
      q: "a",
    });
  });
});
