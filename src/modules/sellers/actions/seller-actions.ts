"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAuthenticatedUser, requireSellerAccess } from "@/modules/auth/application/authorization";
import { ApplicationError, asApplicationError } from "@/shared/errors/application-error";

import { sellerOnboardingSchema } from "../schemas/seller-onboarding";
import { shippingOriginSchema } from "../schemas/shipping-origin";

export type SellerActionState = { error?: string; success?: string };

export async function createSellerAction(
  _previousState: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const session = await requireAuthenticatedUser("/seller");
  const parsed = sellerOnboardingSchema.safeParse({
    storeName: formData.get("storeName"),
    storeSlug: formData.get("storeSlug"),
    originPostalCode: String(formData.get("originPostalCode") ?? "").replace(/\D/g, ""),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
  }

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
    const applicationError = asApplicationError(error);
    if (applicationError.code === "INTERNAL_ERROR") {
      return { error: "Não foi possível criar a loja. Verifique se o identificador já está em uso." };
    }
    return { error: applicationError.message };
  }
}

export async function updateShippingOriginAction(
  _previousState: SellerActionState,
  formData: FormData,
): Promise<SellerActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = shippingOriginSchema.safeParse({
    originName: formData.get("originName"),
    originEmail: formData.get("originEmail"),
    originPhone: formData.get("originPhone"),
    originDocument: String(formData.get("originDocument") ?? "").replace(/\D/g, ""),
    originPostalCode: String(formData.get("originPostalCode") ?? "").replace(/\D/g, ""),
    originStreet: formData.get("originStreet"),
    originNumber: formData.get("originNumber"),
    originComplement: formData.get("originComplement") || undefined,
    originNeighborhood: formData.get("originNeighborhood"),
    originCity: formData.get("originCity"),
    originState: formData.get("originState"),
    originStateRegister: formData.get("originStateRegister") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados de envio." };

  try {
    const data = {
      originName: parsed.data.originName,
      originEmail: parsed.data.originEmail,
      originPhone: parsed.data.originPhone,
      originDocument: parsed.data.originDocument,
      originPostalCode: parsed.data.originPostalCode,
      originStreet: parsed.data.originStreet,
      originNumber: parsed.data.originNumber,
      originComplement: parsed.data.originComplement ?? null,
      originNeighborhood: parsed.data.originNeighborhood,
      originCity: parsed.data.originCity,
      originState: parsed.data.originState,
      originStateRegister: parsed.data.originStateRegister ?? null,
    };
    await db.$transaction(async (tx) => {
      const previous = await tx.store.findFirst({
        where: { id: context.store.id, sellerId: context.seller.id },
        select: shippingOriginAuditSelect,
      });
      if (!previous) throw new ApplicationError({ code: "NOT_FOUND", message: "Loja não encontrada." });
      await tx.store.update({ where: { id: context.store.id, sellerId: context.seller.id }, data });
      await tx.auditLog.create({
        data: {
          action: "STORE_SHIPPING_ORIGIN_UPDATED",
          entityType: "STORE",
          entityId: context.store.id,
          actorUserId: context.session.user.id,
          metadata: {
            sellerId: context.seller.id,
            previous: maskShippingOrigin(previous),
            next: maskShippingOrigin(data),
          },
        },
      });
    });
    revalidatePath("/seller", "layout");
    revalidatePath("/seller/orders");
    return { success: "Dados de envio atualizados." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

const shippingOriginAuditSelect = {
  originName: true,
  originEmail: true,
  originPhone: true,
  originDocument: true,
  originPostalCode: true,
  originStreet: true,
  originNumber: true,
  originComplement: true,
  originNeighborhood: true,
  originCity: true,
  originState: true,
  originStateRegister: true,
} as const;

type ShippingOriginSnapshot = { [K in keyof typeof shippingOriginAuditSelect]: string | null };

// CPF/CNPJ never reaches the audit log in clear text; the last two digits are
// enough to show that the document changed.
function maskShippingOrigin(origin: ShippingOriginSnapshot): ShippingOriginSnapshot {
  const digits = origin.originDocument?.replace(/\D/g, "") ?? "";
  return {
    ...origin,
    originDocument: digits ? `${"*".repeat(Math.max(0, digits.length - 2))}${digits.slice(-2)}` : null,
  };
}
