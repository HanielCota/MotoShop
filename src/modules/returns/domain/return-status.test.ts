import { describe, expect, it } from "vitest";

import { getNextReturnStatus } from "./return-status";

describe("getNextReturnStatus", () => {
  it("approves or rejects requests under analysis", () => {
    expect(getNextReturnStatus("REQUESTED", "APPROVE")).toBe("APPROVED");
    expect(getNextReturnStatus("UNDER_REVIEW", "REJECT")).toBe("REJECTED");
  });

  it("registers the received item only after approval", () => {
    expect(getNextReturnStatus("APPROVED", "RECEIVE")).toBe("RETURNED");
    expect(() => getNextReturnStatus("REQUESTED", "RECEIVE")).toThrow("não é permitida");
  });

  it("blocks transitions from final states", () => {
    expect(() => getNextReturnStatus("REFUNDED", "APPROVE")).toThrow("não é permitida");
    expect(() => getNextReturnStatus("REJECTED", "REJECT")).toThrow("não é permitida");
  });
});
