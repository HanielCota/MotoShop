import { z } from "zod";

import {
  formatPhone,
  formatTaxId,
  isValidBrazilianPhone,
  isValidCnpj,
  onlyDigits,
} from "@/modules/customers/domain/tax-id";

import type { CompanyContact, StoredCompanyContact } from "../domain/company-contact";

const MAX_LEGAL_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_URL_LENGTH = 300;
const MAX_HOURS_LENGTH = 60;

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
  return optionalText(MAX_URL_LENGTH, message).refine(
    (value) => value == null || isHttpsUrlOnHost(value, hosts),
    message,
  );
}

/**
 * Admin › Configurações › Empresa e contato. Every field is optional: blank means "use today's text",
 * and blank e-mail or phone means "do not show". CNPJ and phone are stored as digits.
 */
export const companyContactSchema = z.object({
  companyLegalName: optionalText(MAX_LEGAL_NAME_LENGTH, `Use até ${MAX_LEGAL_NAME_LENGTH} caracteres na razão social.`),
  companyCnpj: z
    .string()
    .max(30, "Informe um CNPJ válido.")
    .transform((value) => blankToNull(onlyDigits(value)))
    .refine((value) => value == null || isValidCnpj(value), "Informe um CNPJ válido."),
  supportEmail: optionalText(MAX_EMAIL_LENGTH, "Informe um e-mail válido.")
    .transform((value) => value?.toLowerCase() ?? null)
    .refine((value) => value == null || z.email().safeParse(value).success, "Informe um e-mail válido."),
  supportPhone: z
    .string()
    .max(30, "Informe o telefone com DDD.")
    .transform((value) => blankToNull(onlyDigits(value)))
    .refine((value) => value == null || isValidBrazilianPhone(value), "Informe o telefone com DDD."),
  instagramUrl: optionalProfileUrl(instagramHosts, "Informe o endereço do Instagram, começando com https://."),
  youtubeUrl: optionalProfileUrl(youtubeHosts, "Informe o endereço do YouTube, começando com https://."),
  weekdayHours: optionalText(MAX_HOURS_LENGTH, `Use até ${MAX_HOURS_LENGTH} caracteres no horário.`),
  saturdayHours: optionalText(MAX_HOURS_LENGTH, `Use até ${MAX_HOURS_LENGTH} caracteres no horário.`),
  sundayHolidayHours: optionalText(MAX_HOURS_LENGTH, `Use até ${MAX_HOURS_LENGTH} caracteres no horário.`),
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
