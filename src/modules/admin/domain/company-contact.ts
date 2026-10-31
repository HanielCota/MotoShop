import { BRAND_COMPANY_DEFAULTS } from "@/config/brand";
import { formatTaxId } from "@/modules/customers/domain/tax-id";

/** Company and contact as stored in `MarketplaceConfiguration`; null means "use the code default". */
export type StoredCompanyContact = {
  companyLegalName: string | null;
  companyCnpj: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  weekdayHours: string | null;
  saturdayHours: string | null;
  sundayHolidayHours: string | null;
};

/** What the footers show. E-mail and phone stay null when blank: there is no default to show. */
export type CompanyContact = {
  legalName: string;
  cnpj: string;
  supportEmail: string | null;
  supportPhone: string | null;
  instagramUrl: string;
  youtubeUrl: string;
  weekdayHours: string;
  saturdayHours: string;
  sundayHolidayHours: string;
};

/** Stored fields in a fixed order, used to compare saves for the audit log. */
export const companyContactFields = [
  "companyLegalName",
  "companyCnpj",
  "supportEmail",
  "supportPhone",
  "instagramUrl",
  "youtubeUrl",
  "weekdayHours",
  "saturdayHours",
  "sundayHolidayHours",
] as const satisfies readonly (keyof StoredCompanyContact)[];

/** A configuration with nothing filled in: every field shows the code default. */
export const emptyStoredCompanyContact: StoredCompanyContact = {
  companyLegalName: null,
  companyCnpj: null,
  supportEmail: null,
  supportPhone: null,
  instagramUrl: null,
  youtubeUrl: null,
  weekdayHours: null,
  saturdayHours: null,
  sundayHolidayHours: null,
};

/**
 * Fills every blank field with the text the site shows today.
 *
 * @param stored - The configuration row, or null when the marketplace has none yet.
 * @returns The contact the site and e-mail footers render.
 */
export function resolveCompanyContact(stored: StoredCompanyContact | null): CompanyContact {
  const values = stored ?? emptyStoredCompanyContact;

  return {
    legalName: values.companyLegalName ?? BRAND_COMPANY_DEFAULTS.legalName,
    cnpj: values.companyCnpj ?? BRAND_COMPANY_DEFAULTS.cnpj,
    supportEmail: values.supportEmail,
    supportPhone: values.supportPhone,
    instagramUrl: values.instagramUrl ?? BRAND_COMPANY_DEFAULTS.instagramUrl,
    youtubeUrl: values.youtubeUrl ?? BRAND_COMPANY_DEFAULTS.youtubeUrl,
    weekdayHours: values.weekdayHours ?? BRAND_COMPANY_DEFAULTS.weekdayHours,
    saturdayHours: values.saturdayHours ?? BRAND_COMPANY_DEFAULTS.saturdayHours,
    sundayHolidayHours: values.sundayHolidayHours ?? BRAND_COMPANY_DEFAULTS.sundayHolidayHours,
  };
}

/** Rights line of both footers, e.g. "© 2026 MOTO SHOP BRASIL …. Todos os direitos reservados." */
export function formatCopyrightLine(legalName: string, year: string): string {
  return `© ${year} ${legalName}. Todos os direitos reservados.`;
}

/** CNPJ line of both footers; the CNPJ comes as 14 digits and is shown masked. */
export function formatCnpjLine(cnpj: string): string {
  return `CNPJ: ${formatTaxId(cnpj)}`;
}

/** WhatsApp click-to-chat link; the stored phone has the area code, so only the country code is added. */
export function whatsAppHref(phone: string): string {
  return `https://wa.me/55${phone}`;
}

/** Instagram and YouTube links for both footers, in this order. */
export function companySocialLinks(contact: CompanyContact) {
  return [
    { name: "Instagram", href: contact.instagramUrl },
    { name: "YouTube", href: contact.youtubeUrl },
  ] as const;
}

/** Fields whose stored value changes, with both sides, for the audit log. */
export function diffStoredCompanyContact(previous: StoredCompanyContact, next: StoredCompanyContact) {
  const changed = companyContactFields.filter((field) => previous[field] !== next[field]);

  return {
    previous: Object.fromEntries(changed.map((field) => [field, previous[field]])),
    next: Object.fromEntries(changed.map((field) => [field, next[field]])),
    changedFields: changed,
  };
}
