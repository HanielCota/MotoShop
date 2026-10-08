import { describe, expect, it } from "vitest";

import {
  cancellationRefundBaseKey,
  MAX_REFUND_ATTEMPTS,
  parseRefundAttempt,
  planRefundAttempt,
  refundAttemptKey,
  returnRefundBaseKey,
} from "./refund-attempt";

const base = cancellationRefundBaseKey("req-1");

describe("refund attempt keys", () => {
  it("keeps the legacy key for the first attempt and suffixes later ones", () => {
    expect(base).toBe("cancellation-refund:req-1");
    expect(returnRefundBaseKey("ret-1")).toBe("return-refund:ret-1");
    expect(refundAttemptKey(base, 1)).toBe(base);
    expect(refundAttemptKey(base, 2)).toBe(`${base}:retry-1`);
    expect(refundAttemptKey(base, 3)).toBe(`${base}:retry-2`);
    expect(() => refundAttemptKey(base, 0)).toThrow();
  });

  it("parses only keys that belong to the same request", () => {
    expect(parseRefundAttempt(base, base)).toBe(1);
    expect(parseRefundAttempt(base, `${base}:retry-4`)).toBe(5);
    expect(parseRefundAttempt(base, `${base}:retry-0`)).toBeNull();
    expect(parseRefundAttempt(base, `${base}:retry-x`)).toBeNull();
    expect(parseRefundAttempt(base, "cancellation-refund:req-10")).toBeNull();
  });
});

describe("planRefundAttempt", () => {
  it("starts with the base key when there is no previous attempt", () => {
    expect(planRefundAttempt(base, [])).toEqual({ idempotencyKey: base, attempt: 1, resumesExisting: false });
  });

  it("reuses a pending attempt so the provider outcome is reconciled", () => {
    expect(
      planRefundAttempt(base, [
        { idempotencyKey: base, status: "FAILED" },
        { idempotencyKey: `${base}:retry-1`, status: "PENDING" },
      ]),
    ).toEqual({ idempotencyKey: `${base}:retry-1`, attempt: 2, resumesExisting: true });
  });

  it("reuses a succeeded attempt instead of refunding twice", () => {
    expect(
      planRefundAttempt(base, [
        { idempotencyKey: base, status: "SUCCEEDED" },
        { idempotencyKey: `${base}:retry-1`, status: "FAILED" },
      ]),
    ).toEqual({ idempotencyKey: base, attempt: 1, resumesExisting: true });
  });

  it("derives a new key only when every previous attempt failed", () => {
    expect(
      planRefundAttempt(base, [
        { idempotencyKey: base, status: "FAILED" },
        { idempotencyKey: `${base}:retry-1`, status: "FAILED" },
        { idempotencyKey: "cancellation-refund:other", status: "SUCCEEDED" },
      ]),
    ).toEqual({ idempotencyKey: `${base}:retry-2`, attempt: 3, resumesExisting: false });
  });

  it("stops after the maximum number of failed attempts", () => {
    const failed = Array.from({ length: MAX_REFUND_ATTEMPTS }, (_, index) => ({
      idempotencyKey: refundAttemptKey(base, index + 1),
      status: "FAILED" as const,
    }));
    expect(() => planRefundAttempt(base, failed)).toThrow("limite de tentativas");
  });
});
