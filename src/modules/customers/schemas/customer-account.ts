import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Compartilhado entre o formulário e a server action: o servidor sempre revalida. */
export const customerNameSchema = z.object({
  name: z
    .string({ error: "Informe seu nome." })
    .trim()
    .min(2, "Informe seu nome com pelo menos 2 letras.")
    .max(120, "Use no máximo 120 caracteres."),
});

export type CustomerNameInput = z.infer<typeof customerNameSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual.").max(PASSWORD_MAX_LENGTH),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`),
    confirmation: z.string().min(1, "Repita a nova senha."),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ["confirmation"],
    message: "As senhas não coincidem.",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha precisa ser diferente da atual.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
