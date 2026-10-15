import { expect, it } from "vitest";

import { getProductCardBadges } from "./product-card-badges";

const none = { isDemo: false, sponsored: false, onSale: false, isNew: false };

it.each([
  [{ ...none }, []],
  [{ ...none, isNew: true }, ["NEW"]],
  [{ ...none, onSale: true, isNew: true }, ["SALE", "NEW"]],
  [{ ...none, sponsored: true, onSale: true, isNew: true }, ["SPONSORED", "SALE"]],
  [{ ...none, isDemo: true, isNew: true }, ["DEMO", "NEW"]],
  [{ ...none, isDemo: true, onSale: true, isNew: true }, ["DEMO", "SALE"]],
  [{ ...none, isDemo: true, sponsored: true, isNew: true }, ["DEMO", "NEW"]],
] as const)("shows at most two badges by priority for %o", (input, expected) => {
  expect(getProductCardBadges(input)).toEqual(expected);
});
