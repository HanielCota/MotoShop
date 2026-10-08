import { z } from "zod";

/** Campos de endereço que podem ser preenchidos automaticamente a partir do CEP. */
export const CEP_AUTOFILL_FIELDS = ["street", "neighborhood", "city", "state"] as const;
export type CepAutofillField = (typeof CEP_AUTOFILL_FIELDS)[number];
export type CepAddress = Record<CepAutofillField, string>;
export type CepAutofillMemory = Partial<Record<CepAutofillField, string>>;

/** Siglas das 27 unidades federativas aceitas em endereços de entrega. */
export const BRAZILIAN_STATE_CODES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export function isBrazilianStateCode(value: string): boolean {
  return (BRAZILIAN_STATE_CODES as readonly string[]).includes(value);
}

/** Mantém somente os dígitos do CEP (máximo de 8), formato esperado pelo servidor. */
export function normalizeCep(value: string): string {
  return value.replace(/\D/g, "").slice(0, 8);
}

/** Máscara progressiva 00000-000 para exibição. */
export function formatCep(value: string): string {
  const digits = normalizeCep(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isCompleteCep(value: string): boolean {
  return normalizeCep(value).length === 8;
}

/** Mantém somente os dígitos do CPF (máximo de 11). */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Máscara progressiva 000.000.000-00 para exibição. */
export function formatCpf(value: string): string {
  const digits = normalizeCpf(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

const viaCepResponseSchema = z.object({
  logradouro: z.string().optional().default(""),
  bairro: z.string().optional().default(""),
  localidade: z.string().optional().default(""),
  uf: z.string().optional().default(""),
});

/**
 * Valida a resposta (externa) do ViaCEP. Retorna `null` para CEP inexistente
 * (`{ "erro": true }`) ou payload inesperado.
 */
export function parseViaCepResponse(payload: unknown): CepAddress | null {
  if (!payload || typeof payload !== "object" || "erro" in payload) return null;
  const parsed = viaCepResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  const address: CepAddress = {
    street: parsed.data.logradouro.trim(),
    neighborhood: parsed.data.bairro.trim(),
    city: parsed.data.localidade.trim(),
    state: parsed.data.uf.trim().toUpperCase().slice(0, 2),
  };
  return address.city || address.state ? address : null;
}

/**
 * Aplica o endereço encontrado sem sobrescrever o que a pessoa digitou: um campo só
 * é preenchido quando está vazio ou ainda contém o valor de um preenchimento automático anterior.
 */
export function applyCepAutofill<T extends Record<CepAutofillField, string>>(
  current: T,
  address: CepAddress,
  previous: CepAutofillMemory,
): { values: T; autofilled: CepAutofillMemory } {
  const values = { ...current };
  const autofilled: CepAutofillMemory = {};
  for (const field of CEP_AUTOFILL_FIELDS) {
    const currentValue = current[field];
    const canOverwrite = currentValue.trim() === "" || currentValue === previous[field];
    if (canOverwrite && address[field]) {
      values[field] = address[field] as T[CepAutofillField];
      autofilled[field] = address[field];
    }
  }
  return { values, autofilled };
}
