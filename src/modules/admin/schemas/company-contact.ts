import { z } from "zod";

import {
  formatPhone,
  formatTaxId,
  isValidBrazilianPhone,
  isValidCnpj,
  onlyDigits,
} from "@/modules/customers/domain/tax-id";

import type { CompanyContact, StoredCompanyContact } from "../domain/company-contact";

/** Field limits shared by the server validation and the form inputs. */
export const COMPANY_CONTACT_LIMITS = {
  legalName: 120,
  email: 254,
  url: 300,
  hours: 60,
  maskedCnpj: 18,
  maskedPhone: 15,
} as const;

// Raw CNPJ and phone are cut down to digits; this only stops oversized input before that.
const MAX_RAW_DIGITS_INPUT_LENGTH = 30;

const instagramHosts = new Set(["instagram.com", "www.instagram.com"]);
const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

/** Normalizes a trimmed value; a blank one becomes null so the footer uses the default. */
function blankToNull(value: string): string | null {
  const normalized = value.normalize("NFC").trim();
  return normalized === "" ? null : normalized;
}

function optionalText(maxLength: number, message: string) {
  return z.string().trim().max(maxLength, message).transform(blankToNull);
}

function isHttpsUrlOnHost(value: string, hosts: ReadonlySet<string>): boolean {
  if (URL.canParse(value) === false) return false;

  const url = new URL(value);
  return url.protocol === "https:" && hosts.has(url.hostname.toLowerCase());
}

function optionalProfileUrl(hosts: ReadonlySet<string>, message: string) {
  return optionalText(COMPANY_CONTACT_LIMITS.url, message).refine(
    (value) => value == null || isHttpsUrlOnHost(value, hosts),
    message,
  );
}

const hoursMessage = `Use até ${COMPANY_CONTACT_LIMITS.hours} caracteres no horário.`;

/**
 * Admin › Configurações › Empresa e contato. Every field is optional: blank means "use today's text",
 * and blank e-mail or phone means "do not show". CNPJ and phone are stored as digits.
 */
export const companyContactSchema = z.object({
  companyLegalName: optionalText(
    COMPANY_CONTACT_LIMITS.legalName,
    `Use até ${COMPANY_CONTACT_LIMITS.legalName} caracteres na razão social.`,
  ),
  companyCnpj: z
    .string()
    .max(MAX_RAW_DIGITS_INPUT_LENGTH, "Informe um CNPJ válido.")
    .transform((value) => blankToNull(onlyDigits(value)))
    .refine((value) => value == null || isValidCnpj(value), "Informe um CNPJ válido."),
  supportEmail: optionalText(COMPANY_CONTACT_LIMITS.email, "Informe um e-mail válido.")
    .transform((value) => value?.toLowerCase() ?? null)
    .refine((value) => value == null || z.email().safeParse(value).success, "Informe um e-mail válido."),
  supportPhone: z
    .string()
    .max(MAX_RAW_DIGITS_INPUT_LENGTH, "Informe o telefone com DDD.")
    .transform((value) => blankToNull(onlyDigits(value)))
    .refine((value) => value == null || isValidBrazilianPhone(value), "Informe o telefone com DDD."),
  instagramUrl: optionalProfileUrl(instagramHosts, "Informe o endereço do Instagram, começando com https://."),
  youtubeUrl: optionalProfileUrl(youtubeHosts, "Informe o endereço do YouTube, começando com https://."),
  weekdayHours: optionalText(COMPANY_CONTACT_LIMITS.hours, hoursMessage),
  saturdayHours: optionalText(COMPANY_CONTACT_LIMITS.hours, hoursMessage),
  sundayHolidayHours: optionalText(COMPANY_CONTACT_LIMITS.hours, hoursMessage),
}) satisfies z.ZodType<StoredCompanyContact, CompanyContactFormInput>;

/** What the form fields hold: plain strings, masked CNPJ and phone included. */
export type CompanyContactFormInput = Record<keyof StoredCompanyContact, string>;

/** Form values for the current contact, so the admin sees the text the footers show today. */
export function companyContactFormValues(contact: CompanyContact): CompanyContactFormInput {
  return {
    companyLegalName: contact.legalName,
    companyCnpj: formatTaxId(contact.cnpj),
    supportEmail: contact.supportEmail ?? "",
    supportPhone: formatPhone(contact.supportPhone ?? ""),
    instagramUrl: contact.instagramUrl,
    youtubeUrl: contact.youtubeUrl,
    weekdayHours: contact.weekdayHours,
    saturdayHours: contact.saturdayHours,
    sundayHolidayHours: contact.sundayHolidayHours,
  };
}
