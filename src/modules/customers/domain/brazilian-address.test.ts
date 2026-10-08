import { describe, expect, it } from "vitest";

import {
  applyCepAutofill,
  formatCep,
  formatCpf,
  isCompleteCep,
  normalizeCep,
  normalizeCpf,
  parseViaCepResponse,
} from "./brazilian-address";

describe("CEP helpers", () => {
  it("masks progressively and normalizes to 8 digits", () => {
    expect(formatCep("01001")).toBe("01001");
    expect(formatCep("010010")).toBe("01001-0");
    expect(formatCep("01001000")).toBe("01001-000");
    expect(formatCep("01001-000123")).toBe("01001-000");
    expect(normalizeCep("01001-000")).toBe("01001000");
    expect(normalizeCep("abc")).toBe("");
    expect(isCompleteCep("01001-000")).toBe(true);
    expect(isCompleteCep("01001-00")).toBe(false);
  });
});

describe("CPF helpers", () => {
  it("masks progressively and normalizes to 11 digits", () => {
    expect(formatCpf("123")).toBe("123");
    expect(formatCpf("1234")).toBe("123.4");
    expect(formatCpf("1234567")).toBe("123.456.7");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("529.982.247-2599")).toBe("529.982.247-25");
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });
});

describe("parseViaCepResponse", () => {
  it("maps a ViaCEP payload", () => {
    expect(
      parseViaCepResponse({
        cep: "01001-000",
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "sp",
      }),
    ).toEqual({ street: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP" });
  });

  it("rejects unknown CEPs and unexpected payloads", () => {
    expect(parseViaCepResponse({ erro: true })).toBeNull();
    expect(parseViaCepResponse({ erro: "true" })).toBeNull();
    expect(parseViaCepResponse(null)).toBeNull();
    expect(parseViaCepResponse("oops")).toBeNull();
    expect(parseViaCepResponse({ logradouro: 1 })).toBeNull();
  });
});

describe("applyCepAutofill", () => {
  const address = { street: "Praça da Sé", neighborhood: "Sé", city: "São Paulo", state: "SP" };

  it("fills empty fields and remembers them", () => {
    const result = applyCepAutofill({ street: "", neighborhood: "", city: "", state: "", number: "10" }, address, {});
    expect(result.values).toEqual({ ...address, number: "10" });
    expect(result.autofilled).toEqual(address);
  });

  it("keeps values typed by the customer and replaces previous auto-filled values", () => {
    const result = applyCepAutofill(
      { street: "Rua digitada", neighborhood: "Centro", city: "Rio de Janeiro", state: "" },
      address,
      { neighborhood: "Centro", city: "Rio de Janeiro" },
    );
    expect(result.values).toEqual({ street: "Rua digitada", neighborhood: "Sé", city: "São Paulo", state: "SP" });
    expect(result.autofilled).toEqual({ neighborhood: "Sé", city: "São Paulo", state: "SP" });
  });

  it("does not clear a field when ViaCEP has no value for it", () => {
    const result = applyCepAutofill(
      { street: "", neighborhood: "", city: "", state: "" },
      { ...address, street: "" },
      {},
    );
    expect(result.values.street).toBe("");
    expect(result.autofilled.street).toBeUndefined();
  });
});
