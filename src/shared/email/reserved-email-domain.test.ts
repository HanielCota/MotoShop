import { describe, expect, it } from "vitest";

import { isReservedEmailAddress, withoutReservedRecipients } from "./reserved-email-domain";

describe("isReservedEmailAddress", () => {
  it.each([
    "qa-123@example.test",
    "review.cliente@example.test",
    "Someone@Example.COM",
    "a@example.org",
    "a@example.net",
    "a@mail.example.com",
    "a@anything.example",
    "a@x.invalid",
    "a@dev.localhost",
    "Nome <a@example.test>",
  ])("blocks %s", (address) => {
    expect(isReservedEmailAddress(address)).toBe(true);
  });

  it.each([
    "cliente@gmail.com",
    "loja@motoshopbrasil.com.br",
    "a@example.com.br",
    "a@notexample.com",
    "a@testing.com",
    "a@mytest.io",
  ])("allows %s", (address) => {
    expect(isReservedEmailAddress(address)).toBe(false);
  });
});

describe("withoutReservedRecipients", () => {
  it("keeps only deliverable recipients and counts the skipped ones", () => {
    expect(withoutReservedRecipients(["a@gmail.com", "qa@example.test", "b@example.com"])).toEqual({
      deliverable: ["a@gmail.com"],
      skipped: 2,
    });
    expect(withoutReservedRecipients("a@gmail.com")).toEqual({ deliverable: ["a@gmail.com"], skipped: 0 });
  });
});
