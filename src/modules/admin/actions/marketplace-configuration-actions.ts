"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { logActionFailure, toActionError } from "@/shared/errors/action-error";
import { readSubmittedValues } from "@/shared/forms/submitted-values";

import { updateCompanyContact } from "../application/company-contact";
import { companyContactSchema } from "../schemas/company-contact";

import {
  commissionSchema,
  DEFAULT_COMMISSION_ERROR,
  readDefaultCommissionInput,
} from "../schemas/marketplace-commission";

export type CommissionActionState = { error?: string; success?: string; values?: { commissionPercent: string } };

export async function updateMarketplaceCommissionAction(
  _previousState: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const session = await requireAdminAccess();
  const parsed = commissionSchema.safeParse(readDefaultCommissionInput(formData));
  const values = readSubmittedValues(formData, ["commissionPercent"] as const);
  if (!parsed.success) return { error: DEFAULT_COMMISSION_ERROR, values };

  try {
    await db.$transaction(
      async (tx) => {
        const previous = await tx.marketplaceConfiguration.findUnique({ where: { key: "default" } });
        await tx.marketplaceConfiguration.upsert({
          where: { key: "default" },
          create: { key: "default", defaultCommissionBps: parsed.data.defaultCommissionBps },
          update: { defaultCommissionBps: parsed.data.defaultCommissionBps },
        });
        await tx.auditLog.create({
          data: {
            action: "MARKETPLACE_COMMISSION_UPDATED",
            entityType: "MarketplaceConfiguration",
            entityId: "default",
            metadata: {
              previousCommissionBps: previous?.defaultCommissionBps ?? null,
              nextCommissionBps: parsed.data.defaultCommissionBps,
            } as Prisma.InputJsonValue,
            actorUserId: session.user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    revalidatePath("/admin", "layout");
    return { success: "Comissão padrão atualizada." };
  } catch (error) {
    logActionFailure("updateMarketplaceCommissionAction", error);
    return { error: "Não foi possível atualizar a comissão padrão.", values };
  }
}

export type CompanyContactActionState = { error?: string; success?: string };

export async function updateCompanyContactAction(input: unknown): Promise<CompanyContactActionState> {
  const session = await requireAdminAccess();
  const parsed = companyContactSchema.safeParse(input);
  if (parsed.success === false) return { error: parsed.error.issues[0]?.message ?? "Confira os dados informados." };

  try {
    const result = await updateCompanyContact(session.user.id, parsed.data);
    if (result.changed === false) return { success: "Nada mudou: empresa e contato continuam iguais." };

    // The site footer is in the root layout and the admin pages list the audit log.
    revalidatePath("/", "layout");
    return { success: "Empresa e contato atualizados. O rodapé do site e dos e-mails já usa os novos dados." };
  } catch (error) {
    const applicationError = toActionError(error, "updateCompanyContactAction");
    return {
      error:
        applicationError.code === "INTERNAL_ERROR"
          ? "Não foi possível salvar empresa e contato."
          : applicationError.message,
    };
  }
}
