import { describe, expect, it } from "vitest";

import { resolveCompanyContact } from "../domain/company-contact";
import { companyContactFormValues, companyContactSchema, type CompanyContactFormInput } from "./company-contact";

const blankForm: CompanyContactFormInput = {
  companyLegalName: "",
  companyCnpj: "",
  supportEmail: "",
  supportPhone: "",
  instagramUrl: "",
  youtubeUrl: "",
  weekdayHours: "",
  saturdayHours: "",
  sundayHolidayHours: "",
};

function firstError(input: Partial<CompanyContactFormInput>) {
  const result = companyContactSchema.safeParse({ ...blankForm, ...input });
  return result.success ? null : (result.error.issues[0]?.message ?? null);
}

const instagramError = "Informe o endereço do Instagram, começando com https://.";
const youtubeError = "Informe o endereço do YouTube, começando com https://.";

describe("companyContactSchema", () => {
  it("stores blank fields as null, so the footer keeps today's text", () => {
    const parsed = companyContactSchema.parse({ ...blankForm, weekdayHours: "   " });

    expect(parsed).toEqual({
      companyLegalName: null,
      companyCnpj: null,
      supportEmail: null,
      supportPhone: null,
      instagramUrl: null,
      youtubeUrl: null,
      weekdayHours: null,
      saturdayHours: null,
      sundayHolidayHours: null,
    });
  });

  it("keeps CNPJ and phone as digits and the e-mail in lower case", () => {
    const parsed = companyContactSchema.parse({
      ...blankForm,
      companyCnpj: "69.663.409/0001-94",
      supportPhone: "(11) 91234-5678",
      supportEmail: "  Atendimento@MotoShopBrasil.com.br ",
    });

    expect(parsed.companyCnpj).toBe("69663409000194");
    expect(parsed.supportPhone).toBe("11912345678");
    expect(parsed.supportEmail).toBe("atendimento@motoshopbrasil.com.br");
  });

  it("accepts the form as it opens today, with the current texts filled in", () => {
    const result = companyContactSchema.safeParse(companyContactFormValues(resolveCompanyContact(null)));

    expect(result.success).toBe(true);
  });

  it.each([
    [{ companyCnpj: "11.111.111/1111-11" }, "Informe um CNPJ válido."],
    [{ supportEmail: "atendimento@" }, "Informe um e-mail válido."],
    [{ supportPhone: "(11) 1234" }, "Informe o telefone com DDD."],
    [{ instagramUrl: "http://www.instagram.com/motoshop" }, instagramError],
    [{ instagramUrl: "https://instagram.evil.example/motoshop" }, instagramError],
    [{ youtubeUrl: "javascript:alert(1)" }, youtubeError],
    [{ companyLegalName: "A".repeat(121) }, "Use até 120 caracteres na razão social."],
    [{ saturdayHours: "9".repeat(61) }, "Use até 60 caracteres no horário."],
  ])("refuses %o with a message in Portuguese", (input, message) => {
    const error = firstError(input);

    expect(error).toBe(message);
  });
});
