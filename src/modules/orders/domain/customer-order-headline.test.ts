import { expect, it } from "vitest";

import { customerOrderBadgeStatus, customerOrderHeadline } from "./customer-order-headline";

it("speaks the customer's language for each order stage", () => {
  expect(customerOrderHeadline("PENDING_PAYMENT")).toBe("Pague para confirmar");
  expect(customerOrderHeadline("PROCESSING")).toBe("Em preparação");
  expect(customerOrderHeadline("PARTIALLY_SHIPPED")).toBe("A caminho");
  expect(customerOrderHeadline("DELIVERED")).toBe("Entregue");
  expect(customerOrderHeadline("SOMETHING_NEW")).toBe("Em andamento");
});

it("gives statuses with the same words the same badge color, so A caminho is never orange and blue", () => {
  for (const [first, second] of [
    ["PAID", "PROCESSING"],
    ["PARTIALLY_SHIPPED", "SHIPPED"],
  ] as const) {
    expect(customerOrderHeadline(first)).toBe(customerOrderHeadline(second));
    expect(customerOrderBadgeStatus(first)).toBe(customerOrderBadgeStatus(second));
  }
});
