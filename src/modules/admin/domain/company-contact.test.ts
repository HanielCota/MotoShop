import { describe, expect, it } from "vitest";

import {
  diffStoredCompanyContact,
  emptyStoredCompanyContact,
  formatCnpjLine,
  formatCopyrightLine,
  resolveCompanyContact,
  whatsAppHref,
  withoutCodeDefaults,
} from "./company-contact";

describe("resolveCompanyContact", () => {
  it("shows today's texts when the marketplace has no configuration yet", () => {
    const contact = resolveCompanyContact(null);

    expect(contact).toEqual({
      legalName: "MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE",
      cnpj: "69663409000194",
      supportEmail: null,
      supportPhone: null,
      instagramUrl: "https://www.instagram.com/motoshopbrasil.com.br/",
      youtubeUrl: "https://www.youtube.com/@motoshopbrasilcombr",
      weekdayHours: "08h30 às 18h30",
      saturdayHours: "09h00 às 13h00",
      sundayHolidayHours: "Retorna no próximo dia útil!",
    });
  });

  it("uses each saved value and falls back field by field for the blank ones", () => {
    const contact = resolveCompanyContact({
      ...emptyStoredCompanyContact,
      companyLegalName: "MOTO SHOP COMERCIO LTDA",
      supportPhone: "11912345678",
    });

    expect(contact.legalName).toBe("MOTO SHOP COMERCIO LTDA");
    expect(contact.supportPhone).toBe("11912345678");
    expect(contact.cnpj).toBe("69663409000194");
    expect(contact.supportEmail).toBeNull();
  });
});

describe("withoutCodeDefaults", () => {
  it("stores the texts the form opened with as blank, keeping only what the admin typed", () => {
    const formAsOpened = {
      companyLegalName: "MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE",
      companyCnpj: "69663409000194",
      supportEmail: null,
      supportPhone: "11912345678",
      instagramUrl: "https://www.instagram.com/motoshopbrasil.com.br/",
      youtubeUrl: "https://www.youtube.com/@motoshopbrasilcombr",
      weekdayHours: "08h30 às 18h30",
      saturdayHours: "Fechado",
      sundayHolidayHours: "Retorna no próximo dia útil!",
    };

    const stored = withoutCodeDefaults(formAsOpened);

    expect(stored).toEqual({ ...emptyStoredCompanyContact, supportPhone: "11912345678", saturdayHours: "Fechado" });
  });
});

describe("footer lines", () => {
  it("writes the rights line with the given year and the CNPJ with its mask", () => {
    expect(formatCopyrightLine("MOTO SHOP BRASIL", "2027")).toBe(
      "© 2027 MOTO SHOP BRASIL. Todos os direitos reservados.",
    );
    expect(formatCnpjLine("69663409000194")).toBe("CNPJ: 69.663.409/0001-94");
  });

  it("links WhatsApp with the Brazil country code before the area code", () => {
    expect(whatsAppHref("11912345678")).toBe("https://wa.me/5511912345678");
  });
});

describe("diffStoredCompanyContact", () => {
  it("lists only the fields that change, with both sides", () => {
    const previous = { ...emptyStoredCompanyContact, supportEmail: "antigo@motoshop.com.br" };
    const next = { ...previous, supportEmail: null, saturdayHours: "Fechado" };

    const changes = diffStoredCompanyContact(previous, next);

    expect(changes).toEqual({
      previous: { supportEmail: "antigo@motoshop.com.br", saturdayHours: null },
      next: { supportEmail: null, saturdayHours: "Fechado" },
      changedFields: ["supportEmail", "saturdayHours"],
    });
  });

  it("reports no change when every field is the same", () => {
    const changes = diffStoredCompanyContact(emptyStoredCompanyContact, { ...emptyStoredCompanyContact });

    expect(changes.changedFields).toEqual([]);
  });
});
