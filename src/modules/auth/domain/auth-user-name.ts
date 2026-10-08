import { customerNameSchema } from "@/modules/customers/schemas/customer-account";

export type AuthUserNameResult = { ok: true; name: string } | { ok: false; message: string };

/**
 * Regra única para o nome gravado pelo Better Auth (cadastro e `/update-user`), para que
 * chamadas diretas à API não contornem a validação dos formulários.
 */
export function parseAuthUserName(name: unknown): AuthUserNameResult {
  const parsed = customerNameSchema.shape.name.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira o nome informado." };
  return { ok: true, name: parsed.data };
}
