import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/modules/customers/schemas/customer-account";

/** "Nova senha" from the recovery link; Better Auth validates the token and length again. */
export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`),
    confirmation: z.string().min(1, "Repita a nova senha."),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ["confirmation"],
    message: "As senhas não coincidem.",
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
