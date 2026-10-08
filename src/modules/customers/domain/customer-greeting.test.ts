import { expect, it } from "vitest";

import { customerGreeting } from "./customer-greeting";

it("greets the customer by first name only", () => {
  expect(customerGreeting("  Luiz Carlos da Silva ")).toBe("Olá, Luiz");
});

it.each([null, undefined, "", "   "])("falls back to a neutral greeting for %j", (name) => {
  expect(customerGreeting(name)).toBe("Olá!");
});
