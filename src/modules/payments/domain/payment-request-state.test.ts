import { expect, it } from "vitest";

import {
  decideUnsentCharge,
  preparedPaymentRequestMetadata,
  rejectedPaymentRequestMetadata,
  sentPaymentRequestMetadata,
} from "./payment-request-state";

const now = new Date("2026-10-07T12:00:00.000Z");
const old = new Date("2026-10-07T11:50:00.000Z");
const recent = new Date("2026-10-07T11:59:30.000Z");
const decide = (
  providerMetadata: unknown,
  createdAt = old,
  overrides: Partial<Parameters<typeof decideUnsentCharge>[0]> = {},
) =>
  decideUnsentCharge({
    paymentExternalId: null,
    paymentStatus: "PENDING",
    transaction: { status: "PENDING", providerMetadata, createdAt },
    now,
    ...overrides,
  });

it("releases a request that was never sent once the grace period passed", () => {
  expect(decide(preparedPaymentRequestMetadata())).toBe("RELEASE_NEVER_SENT");
  expect(decide(preparedPaymentRequestMetadata(), recent)).toBe("WAIT");
});

it("releases a definitively rejected request", () => {
  expect(decide(rejectedPaymentRequestMetadata({ sentAt: old, rejectedAt: old, httpStatus: 429 }), recent)).toBe(
    "RELEASE_REJECTED",
  );
});

it("asks the provider for sent, legacy or already identified charges", () => {
  expect(decide(sentPaymentRequestMetadata(old))).toBe("ASK_PROVIDER");
  expect(decide(null)).toBe("ASK_PROVIDER");
  expect(decide({ status: "pending" })).toBe("ASK_PROVIDER");
  expect(decide(preparedPaymentRequestMetadata(), old, { paymentExternalId: "mp-1" })).toBe("ASK_PROVIDER");
  expect(decide(preparedPaymentRequestMetadata(), old, { paymentStatus: "PROCESSING" })).toBe("ASK_PROVIDER");
  expect(decide(preparedPaymentRequestMetadata(), old, { transaction: undefined })).toBe("ASK_PROVIDER");
});
