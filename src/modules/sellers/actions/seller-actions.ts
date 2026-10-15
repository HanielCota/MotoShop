"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAuthenticatedUser, requireSellerAccess } from "@/modules/auth/application/authorization";
import { ApplicationError } from "@/shared/errors/application-error";
import { toActionError } from "@/shared/errors/action-error";

import { updateShippingOrigin } from "../application/update-shipping-origin";
import { readSellerOnboardingInput, sellerOnboardingSchema } from "../schemas/seller-onboarding";
import { shippingOriginSchema } from "../schemas/shipping-origin";
import { splitStoreSlugIssue } from "../schemas/store-slug";
import { readSubmittedValues } from "@/shared/forms/submitted-values";

const onboardingFields = ["storeName", "storeSlug", "originPostalCode", "type"] as const;

export type SellerActionState = {
  error?: string;
  success?: string;
  slugError?: string;
  values?: Record<(typeof onboardingFields)[number], string>;
};

export async function createSellerAction(
  _previousState: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const session = await requireAuthenticatedUser("/seller");
  const parsed = sellerOnboardingSchema.safeParse(readSellerOnboardingInput(formData));

  const values = readSubmittedValues(formData, onboardingFields);
  if (!parsed.success) return { ...splitStoreSlugIssue(parsed.error, "storeSlug"), values };

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${session.user.id} FOR UPDATE`;
      const existingMembership = await tx.sellerMember.findFirst({ where: { userId: session.user.id } });
      if (existingMembership) {
        throw new ApplicationError({
          code: "CONFLICT",
          message: "Este usuário já está vinculado a um lojista.",
          statusCode: 409,
        });
      }

      const seller = await tx.seller.create({ data: { type: parsed.data.type, status: "PENDING" } });
      await tx.store.create({
        data: {
          name: parsed.data.storeName,
          slug: parsed.data.storeSlug,
          originPostalCode: parsed.data.originPostalCode,
          sellerId: seller.id,
        },
      });
      await tx.sellerMember.create({ data: { sellerId: seller.id, userId: session.user.id, role: "OWNER" } });
    });

    revalidatePath("/seller", "layout");
    return { success: "Solicitação enviada. O Moto Shop precisa aprovar sua loja antes do cadastro de produtos." };
  } catch (error) {
    const applicationError = toActionError(error, "createSellerAction");
    if (applicationError.code === "INTERNAL_ERROR") {
      return { error: "Não foi possível criar a loja. Verifique se o identificador já está em uso.", values };
    }
    return { error: applicationError.message, values };
  }
}

export async function updateShippingOriginAction(
  _previousState: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = shippingOriginSchema.safeParse(readShippingOriginFormInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados de envio." };

  try {
    const scope = { storeId: context.store.id, sellerId: context.seller.id, actorUserId: context.session.user.id };
    await updateShippingOrigin(scope, parsed.data);

    revalidatePath("/seller", "layout");
    revalidatePath("/seller/orders");
    return { success: "Dados de envio atualizados." };
  } catch (error) {
    return { error: toActionError(error, "updateShippingOriginAction").message };
  }
}

function readShippingOriginFormInput(formData: FormData) {
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

function readDigits(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").replace(/\D/g, "");
}
