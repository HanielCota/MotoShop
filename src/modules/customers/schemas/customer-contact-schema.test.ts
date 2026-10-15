import { describe, expect, it } from "vitest";

import { customerContactSchema } from "./customer-account";

const cpf = "529.982.247-25";
const phone = "(11) 98765-4321";

// The profile form validates on the client and sends the parsed output to the Server Action,
// which validates it again: both steps must agree for every combination of filled fields.
describe("customerContactSchema", () => {
  it.each([
    [
      { taxId: "", phone },
      { taxId: null, phone: "11987654321" },
    ],
    [
      { taxId: cpf, phone: "" },
      { taxId: "52998224725", phone: null },
    ],
    [
      { taxId: "", phone: "" },
      { taxId: null, phone: null },
    ],
    [
      { taxId: cpf, phone },
      { taxId: "52998224725", phone: "11987654321" },
    ],
  ])("accepts %j and again its own output on the server", (formValues, expected) => {
    const formOutput = customerContactSchema.parse(formValues);

    expect(formOutput).toEqual(expected);
    expect(customerContactSchema.parse(formOutput)).toEqual(expected);
  });

  it("treats absent fields as cleared", () => {
    expect(customerContactSchema.parse({})).toEqual({ taxId: null, phone: null });
  });

  it.each([
    [{ taxId: 52998224725, phone: "" }, "Informe um CPF ou CNPJ válido."],
    [{ taxId: "", phone: ["11"] }, "Informe um telefone com DDD, ex.: (11) 98765-4321."],
    [null, "Confira os dados informados."],
    ["texto", "Confira os dados informados."],
  ])("answers unexpected input %j in Portuguese", (input, message) => {
    const result = customerContactSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
