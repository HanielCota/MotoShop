import { expect, it } from "vitest";

import { isLongUnresolvedPayment } from "./unresolved-payment";

const now = new Date("2026-10-14T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

it.each([
  [{ externalId: null, createdAt: hoursAgo(6) }, true],
  [{ externalId: null, createdAt: hoursAgo(5.9) }, false],
  [{ externalId: "mp-1", createdAt: hoursAgo(48) }, false],
])("isLongUnresolvedPayment(%j) → %s (L-09)", (payment, expected) => {
  expect(isLongUnresolvedPayment(payment, now)).toBe(expected);
});
