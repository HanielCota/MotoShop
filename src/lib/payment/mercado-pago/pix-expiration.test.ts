import { expect, it } from "vitest";

import { pixExpirationDate } from "./pix-expiration";

it("expires a Pix 30 minutes later, written in São Paulo time with an explicit offset (M-06)", () => {
  expect(pixExpirationDate(new Date("2026-10-14T15:00:00.000Z"))).toBe("2026-10-14T12:30:00.000-03:00");
});

it("keeps the same instant across midnight", () => {
  const value = pixExpirationDate(new Date("2026-10-15T02:45:00.000Z"));

  expect(value).toBe("2026-10-15T00:15:00.000-03:00");
  expect(new Date(value).toISOString()).toBe("2026-10-15T03:15:00.000Z");
});
