import { describe, expect, it } from "vitest";

import {
  getManualAdjustmentChange,
  getManualAdjustmentReason,
  parseManualAdjustmentQuantity,
  validateManualAdjustment,
} from "./manual-adjustment";

describe("manual inventory adjustment", () => {
  it("adds, removes or corrects the available quantity", () => {
    expect(getManualAdjustmentChange({ kind: "IN", quantity: 6 }, 2)).toBe(6);
    expect(getManualAdjustmentChange({ kind: "OUT", quantity: 1 }, 2)).toBe(-1);
    expect(getManualAdjustmentChange({ kind: "CORRECTION", quantity: 5 }, 2)).toBe(3);
    expect(getManualAdjustmentChange({ kind: "CORRECTION", quantity: 0 }, 2)).toBe(-2);
  });

  it("accepts zero only as a counted total", () => {
    expect(validateManualAdjustment({ kind: "CORRECTION", quantity: 0 })).toBeNull();
    expect(validateManualAdjustment({ kind: "IN", quantity: 0 })).toBe("Informe uma quantidade maior que zero.");
    expect(validateManualAdjustment({ kind: "OUT", quantity: Number.NaN })).toBe(
      "Informe uma quantidade em números inteiros.",
    );
  });

  it("limits the note length", () => {
    expect(validateManualAdjustment({ kind: "IN", quantity: 1, note: "x".repeat(201) })).toMatch(/200 caracteres/);
  });

  it("records the note or a default reason", () => {
    expect(getManualAdjustmentReason({ kind: "IN", quantity: 1, note: "  NF 1234 " })).toBe("NF 1234");
    expect(getManualAdjustmentReason({ kind: "CORRECTION", quantity: 1 })).toBe("Correção de contagem pelo lojista");
  });

  it("does not read an empty field as zero", () => {
    expect(parseManualAdjustmentQuantity("")).toBeNaN();
    expect(parseManualAdjustmentQuantity("-3")).toBeNaN();
    expect(parseManualAdjustmentQuantity(" 8 ")).toBe(8);
  });
});
