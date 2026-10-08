import { describe, expect, it } from "vitest";

import { getNextDisputeStatus } from "./dispute-status";

describe("getNextDisputeStatus", () => {
  it("moves an open dispute into mediation", () => {
    expect(getNextDisputeStatus("OPEN", "START_REVIEW")).toBe("UNDER_REVIEW");
  });

  it("resolves a dispute only after review", () => {
    expect(getNextDisputeStatus("UNDER_REVIEW", "RESOLVE")).toBe("RESOLVED");
  });

  it("rejects an open dispute", () => {
    expect(getNextDisputeStatus("OPEN", "REJECT")).toBe("REJECTED");
  });

  it("rejects invalid transitions", () => {
    expect(() => getNextDisputeStatus("RESOLVED", "REJECT")).toThrow(/não é válida para o status atual/);
  });
});
