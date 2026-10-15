import { z } from "zod";

import { slugify } from "@/lib/utils";
import { firstIssueMessage } from "@/shared/forms/first-issue-message";

// O slug público deriva do nome: um nome só com símbolos ("!!!") geraria slug vazio.
export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(120, "Use no máximo 120 caracteres.")
    .refine((name) => slugify(name).length > 0, "O nome precisa conter letras ou números."),
});
const sortOrderMessage = "Informe a ordem de exibição como número inteiro, de 0 a 100000.";
const displacementMessage = "Informe a cilindrada em cc, de 1 a 10000.";
const yearMessage = "Informe o ano entre 1900 e 2200.";

export const categorySchema = nameSchema.extend({
  parentId: z.string().cuid("Escolha uma categoria pai válida.").optional(),
  sortOrder: z.coerce
    .number({ error: sortOrderMessage })
    .int(sortOrderMessage)
    .min(0, sortOrderMessage)
    .max(100_000, sortOrderMessage),
});
export const modelSchema = nameSchema.extend({ manufacturerId: z.string().cuid("Escolha o fabricante.") });
export const fitmentSchema = z.object({
  motorcycleModelId: z.string().cuid("Escolha o modelo da moto."),
  version: z.string().trim().max(80, "Use no máximo 80 caracteres na versão."),
  displacementCc: z.coerce
    .number({ error: displacementMessage })
    .int(displacementMessage)
    .positive(displacementMessage)
    .max(10_000, displacementMessage),
  year: z.coerce.number({ error: yearMessage }).int(yearMessage).min(1900, yearMessage).max(2_200, yearMessage),
});

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function readNameInput(formData: FormData) {
  return { name: value(formData, "name") };
}

export function readCategoryInput(formData: FormData) {
  return {
    name: value(formData, "name"),
    parentId: value(formData, "parentId") || undefined,
    sortOrder: value(formData, "sortOrder") || "0",
  };
}

export function readModelInput(formData: FormData) {
  return { name: value(formData, "name"), manufacturerId: value(formData, "manufacturerId") };
}

export function readFitmentInput(formData: FormData) {
  return {
    motorcycleModelId: value(formData, "motorcycleModelId"),
    version: value(formData, "version"),
    displacementCc: value(formData, "displacementCc"),
    year: value(formData, "year"),
  };
}

/** Validadores do navegador (BUG-011), com os mesmos schemas das actions. */
export const catalogFormValidators = {
  category: (formData: FormData) =>
    firstIssueMessage(categorySchema, readCategoryInput(formData), "Categoria inválida."),
  brand: (formData: FormData) => firstIssueMessage(nameSchema, readNameInput(formData), "Marca inválida."),
  manufacturer: (formData: FormData) => firstIssueMessage(nameSchema, readNameInput(formData), "Fabricante inválido."),
  model: (formData: FormData) => firstIssueMessage(modelSchema, readModelInput(formData), "Modelo inválido."),
  fitment: (formData: FormData) => firstIssueMessage(fitmentSchema, readFitmentInput(formData), "Fitment inválido."),
};
