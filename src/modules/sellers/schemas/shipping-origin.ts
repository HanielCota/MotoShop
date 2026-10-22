import { z } from "zod";

import { isValidBrazilianPhone, onlyDigits } from "@/modules/customers/domain/tax-id";
import { firstIssueMessage } from "@/shared/forms/first-issue-message";

export const shippingOriginSchema = z.object({
  originName: z.string().trim().min(2, "Informe o nome do remetente.").max(120),
  originEmail: z.email("Informe um e-mail válido."),
  // Stored as digits, like the customer profile; the field only shows the (00) 00000-0000 mask.
  originPhone: z.string().max(30).transform(onlyDigits).refine(isValidBrazilianPhone, "Informe um telefone válido."),
  originDocument: z
    .string()
    .trim()
    .regex(/^(\d{11}|\d{14})$/, "Informe um CPF ou CNPJ com números."),
  originPostalCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Informe o CEP de origem com 8 números."),
  originStreet: z.string().trim().min(2, "Informe o endereço de origem.").max(120),
  originNumber: z.string().trim().min(1, "Informe o número do endereço.").max(20),
  originComplement: z.string().trim().max(80).optional(),
  originNeighborhood: z.string().trim().min(2, "Informe o bairro.").max(80),
  originCity: z.string().trim().min(2, "Informe a cidade.").max(80),
  originState: z.string().trim().length(2, "Informe a UF.").toUpperCase(),
  originStateRegister: z.string().trim().max(40).optional(),
});

export type ShippingOriginInput = z.infer<typeof shippingOriginSchema>;

function readDigits(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").replace(/\D/g, "");
}

/** Lê o formulário de dados de envio como a action recebe: documento e CEP só com números. */
export function readShippingOriginFormInput(formData: FormData) {
  return {
    originName: formData.get("originName"),
    originEmail: formData.get("originEmail"),
    originPhone: formData.get("originPhone"),
    originDocument: readDigits(formData, "originDocument"),
    originPostalCode: readDigits(formData, "originPostalCode"),
    originStreet: formData.get("originStreet"),
    originNumber: formData.get("originNumber"),
    originComplement: formData.get("originComplement") || undefined,
    originNeighborhood: formData.get("originNeighborhood"),
    originCity: formData.get("originCity"),
    originState: formData.get("originState"),
    originStateRegister: formData.get("originStateRegister") || undefined,
  };
}

/** Mesma regra no navegador e no servidor, sem o balão nativo de campo obrigatório (DN-03). */
export function validateShippingOriginForm(formData: FormData): string | null {
  return firstIssueMessage(shippingOriginSchema, readShippingOriginFormInput(formData), "Confira os dados de envio.");
}
