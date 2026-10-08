"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { logger } from "@/lib/logger";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { auth } from "@/modules/auth/infrastructure/auth";
import { ApplicationError } from "@/shared/errors/application-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import { customerNameSchema } from "../schemas/customer-account";

export type CustomerProfileActionState = { error?: string; success?: string };

export async function updateCustomerNameAction(input: unknown): Promise<CustomerProfileActionState> {
  const session = await requireAuthenticatedUser("/account/profile");
  const parsed = customerNameSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o nome informado." };

  try {
    await assertRateLimit({ key: `update-profile:${session.user.id}`, windowSeconds: 60, max: 5 });
    // A sessão vem dos cookies da request; o Better Auth só altera o próprio usuário autenticado.
    await auth.api.updateUser({ body: { name: parsed.data.name }, headers: await headers() });
  } catch (error) {
    if (error instanceof ApplicationError) return { error: error.message };
    logger.error({
      event: "customer.profile_update_failed",
      userId: session.user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { error: "Não foi possível salvar seu nome agora. Tente novamente em instantes." };
  }

  revalidatePath("/account/profile");
  return { success: "Nome atualizado." };
}
