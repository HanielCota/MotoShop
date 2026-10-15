import { expect, it } from "vitest";

import { parseInventoryAdjustmentInput, validateInventoryAdjustment } from "./inventory-adjustment-input";

it("accepts whole, non-zero adjustments and refuses empty, zero and decimals (BUG-011)", () => {
  expect(validateInventoryAdjustment(parseInventoryAdjustmentInput("5"))).toBeNull();
  expect(validateInventoryAdjustment(parseInventoryAdjustmentInput("-3"))).toBeNull();
  expect(validateInventoryAdjustment(parseInventoryAdjustmentInput(""))).toBe(
    "Informe um ajuste inteiro diferente de zero.",
  );
  expect(validateInventoryAdjustment(parseInventoryAdjustmentInput("0"))).toBe(
    "Informe um ajuste inteiro diferente de zero.",
  );
  expect(validateInventoryAdjustment(parseInventoryAdjustmentInput("1,5"))).toBe(
    "Informe um ajuste inteiro diferente de zero.",
  );
});
