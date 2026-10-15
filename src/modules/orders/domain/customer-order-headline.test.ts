import { expect, it } from "vitest";

import { customerOrderHeadline } from "./customer-order-headline";

it("speaks the customer's language for each order stage", () => {
  expect(customerOrderHeadline("PENDING_PAYMENT")).toBe("Pague para confirmar");
  expect(customerOrderHeadline("PROCESSING")).toBe("Em preparação");
  expect(customerOrderHeadline("PARTIALLY_SHIPPED")).toBe("A caminho");
  expect(customerOrderHeadline("DELIVERED")).toBe("Entregue");
  expect(customerOrderHeadline("SOMETHING_NEW")).toBe("Em andamento");
});
