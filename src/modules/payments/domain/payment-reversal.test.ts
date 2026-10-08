import { expect, it } from "vitest";

import { detectUnexplainedReversal } from "./payment-reversal";

const base = { paymentStatus: "APPROVED", paymentAmountInCents: 10_000, transactions: [] };
const result = (status: "REFUNDED" | "PARTIALLY_REFUNDED" | "PROCESSING" | "APPROVED", metadata = {}) => ({
  status,
  providerMetadata: metadata,
});
const refund = (amountInCents: number, status = "SUCCEEDED") => ({ type: "REFUND", status, amountInCents });

it("flags chargebacks and mediation on paid payments", () => {
  expect(detectUnexplainedReversal({ ...base, result: result("REFUNDED", { status: "charged_back" }) })).toBe(
    "CHARGEBACK",
  );
  expect(detectUnexplainedReversal({ ...base, result: result("PROCESSING", { status: "in_mediation" }) })).toBe(
    "MEDIATION",
  );
});

it("flags refunds not covered by internal refund transactions", () => {
  expect(detectUnexplainedReversal({ ...base, result: result("REFUNDED") })).toBe("OUT_OF_BAND_REFUND");
  expect(detectUnexplainedReversal({ ...base, transactions: [refund(3_000)], result: result("REFUNDED") })).toBe(
    "OUT_OF_BAND_REFUND",
  );
  expect(
    detectUnexplainedReversal({
      ...base,
      transactions: [refund(3_000), refund(4_000, "FAILED")],
      result: result("PARTIALLY_REFUNDED", { transaction_amount_refunded: 50 }),
    }),
  ).toBe("OUT_OF_BAND_REFUND");
});

it("accepts refunds explained by succeeded or pending internal refunds", () => {
  expect(
    detectUnexplainedReversal({ ...base, transactions: [refund(10_000, "PENDING")], result: result("REFUNDED") }),
  ).toBeUndefined();
  expect(
    detectUnexplainedReversal({
      ...base,
      transactions: [refund(3_000)],
      result: result("PARTIALLY_REFUNDED", { transaction_amount_refunded: 30 }),
    }),
  ).toBeUndefined();
});

it("ignores payments that were not paid and regular approvals", () => {
  expect(detectUnexplainedReversal({ ...base, paymentStatus: "PENDING", result: result("REFUNDED") })).toBeUndefined();
  expect(detectUnexplainedReversal({ ...base, result: result("APPROVED", { status: "approved" }) })).toBeUndefined();
});
