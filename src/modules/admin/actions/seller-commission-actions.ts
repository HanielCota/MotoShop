"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";
import { updateSellerCommission } from "../application/update-seller-commission";
import { parseCommissionPercent, sellerCommissionSchema } from "../schemas/seller-commission";

export type SellerCommissionState = { error?: string; success?: string; savedValue?: number | null };

export async function updateSellerCommissionAction(
  sellerId: string,
  _previousState: SellerCommissionState,
  formData: FormData,
): Promise<SellerCommissionState> {
  const session = await requireAdminAccess();
  const parsed = sellerCommissionSchema.safeParse({
    sellerId,
    commissionBpsOverride: parseCommissionPercent(formData.get("commissionPercent")),
    previousCommissionBpsOverride: parseCommissionPercent(formData.get("previousCommissionPercent")),
  });
  if (!parsed.success)
    return {
      error:
        "Informe uma comissão entre 0% e 100%, com até duas casas decimais, ou deixe em branco para usar a padrão.",
    };
  try {
    await updateSellerCommission(session.user.id, parsed.data);
    revalidatePath("/admin", "layout");
    revalidatePath("/seller", "layout");
    return {
      success: "Comissão salva. Pedidos anteriores não foram alterados.",
      savedValue: parsed.data.commissionBpsOverride,
    };
  } catch (error) {
    const applicationError = toActionError(error, "updateSellerCommissionAction");
    return {
      error:
        applicationError.code === "INTERNAL_ERROR" ? "Não foi possível salvar a comissão." : applicationError.message,
    };
  }
}
