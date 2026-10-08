import { z } from "zod";

export const shippingOriginSchema = z.object({
  originName: z.string().trim().min(2, "Informe o nome do remetente.").max(120),
  originEmail: z.email("Informe um e-mail válido."),
  originPhone: z.string().trim().min(10, "Informe um telefone válido.").max(30),
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
