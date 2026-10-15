import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";

import { assertPendingOrderCap } from "@/modules/checkout/application/pending-order-cap";
import { createTestCustomerTaxId } from "../support/customer-tax-id";
import { testDb } from "../support/database";

const email = `pending-cap-${randomUUID()}@example.test`;
const customerTaxId = createTestCustomerTaxId();

function pendingOrder() {
  return {
    orderNumber: `MS-CAP-${randomUUID()}`,
    customerName: "Pending cap fixture",
    customerEmail: email,
    customerPhone: "11999999999",
    customerTaxId,
    itemsSubtotalInCents: 100,
    totalAmountInCents: 100,
  };
}

afterAll(async () => {
  await testDb.order.deleteMany({ where: { customerEmail: email, customerTaxId } });
  await testDb.$disconnect();
});

it("permits only one of two concurrent creations when the CPF already has two pending orders", async () => {
  await testDb.order.createMany({ data: [pendingOrder(), pendingOrder()] });
  const create = () =>
    testDb.$transaction(async (tx) => {
      await assertPendingOrderCap(tx, customerTaxId);
      return tx.order.create({ data: pendingOrder() });
    });

  const outcomes = await Promise.allSettled([create(), create()]);

  expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
  expect(await testDb.order.count({ where: { customerEmail: email, status: "PENDING_PAYMENT" } })).toBe(3);
});
