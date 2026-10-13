import { describe, expect, it } from "vitest";

import { formatPhone, formatTaxId, isValidBrazilianPhone, isValidCnpj, isValidTaxId } from "./tax-id";

describe("isValidCnpj", () => {
  it.each(["11222333000181", "04252011000110"])("accepts %s", (cnpj) => expect(isValidCnpj(cnpj)).toBe(true));
  it.each(["11222333000180", "11111111111111", "1122233300018", "abcdefghijklmn"])("rejects %s", (cnpj) =>
    expect(isValidCnpj(cnpj)).toBe(false),
  );
});

describe("isValidTaxId", () => {
  it("validates CPF and CNPJ by length", () => {
    expect(isValidTaxId("52998224725")).toBe(true);
    expect(isValidTaxId("52998224724")).toBe(false);
    expect(isValidTaxId("11222333000181")).toBe(true);
    expect(isValidTaxId("123")).toBe(false);
  });
});

describe("isValidBrazilianPhone", () => {
  it.each(["11987654321", "1133334444"])("accepts %s", (phone) => expect(isValidBrazilianPhone(phone)).toBe(true));
  it.each(["01987654321", "11887654321", "119876543", "1113334444"])("rejects %s", (phone) =>
    expect(isValidBrazilianPhone(phone)).toBe(false),
  );
});

describe("masks", () => {
  it("formats CPF and CNPJ while typing", () => {
    expect(formatTaxId("529982")).toBe("529.982");
    expect(formatTaxId("52998224725")).toBe("529.982.247-25");
    expect(formatTaxId("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formats landline and mobile phones", () => {
    expect(formatPhone("11")).toBe("(11");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
  });
});
