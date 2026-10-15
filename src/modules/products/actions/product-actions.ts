"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminAccess, requireSellerAccess } from "@/modules/auth/application/authorization";
import { adjustInventoryManually } from "@/modules/inventory/application/adjust-inventory-manually";
import { toActionError } from "@/shared/errors/action-error";

import {
  approveSubmittedProduct,
  archiveSellerProduct,
  rejectSubmittedProduct,
  restoreSellerProduct,
  submitProductForReview,
} from "../application/product-lifecycle";
import { createSellerProduct, updateSellerProduct } from "../application/save-product";
import {
  MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH,
  manualAdjustmentKinds,
  validateManualAdjustment,
} from "@/modules/inventory/domain/manual-adjustment";
import { parseProductForm } from "../schemas/parse-product-form";

export type ProductActionState = { error?: string; success?: string };

const productIdSchema = z.string().cuid();
// The edit form posts the product `updatedAt` it was rendered with; the update
// is conditional on it so a concurrent edit is never silently overwritten.
const revisionSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const INVALID_PRODUCT = "Produto não encontrado.";

/** Visão geral, produtos e histórico de estoque ficam em rotas diferentes da Central do Lojista. */
function revalidateSellerCatalog() {
  revalidatePath("/seller", "layout");
}

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_CREATE");
  const parsed = parseProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do produto." };
  if (new Set(parsed.data.variants.map((variant) => variant.sku.toLowerCase())).size !== parsed.data.variants.length) {
    return { error: "Cada variação precisa ter um SKU diferente." };
  }

  const created = await createProductAndRevalidate(
    { sellerId: context.seller.id, storeId: context.store.id, userId: context.session.user.id },
    parsed.data,
  );
  if ("error" in created) return created;

  redirect(`/seller/products/${created.productId}/edit`);
}

/** Creates the product and revalidates its pages; the redirect stays outside so Next.js can throw it freely. */
async function createProductAndRevalidate(
  ...args: Parameters<typeof createSellerProduct>
): Promise<{ productId: string } | { error: string }> {
  try {
    const productId = await createSellerProduct(...args);
    revalidateSellerCatalog();
    revalidatePath("/products");
    return { productId };
  } catch (error) {
    const applicationError = toActionError(error, "createProductAndRevalidate");
    return {
      error:
        applicationError.code === "INTERNAL_ERROR"
          ? "Não foi possível criar o produto. Confira o slug e o SKU."
          : applicationError.message,
    };
  }
}

export async function submitProductAction(productId: string): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) return { error: INVALID_PRODUCT };
  const result = await submitProductForReview(
    { sellerId: context.seller.id, userId: context.session.user.id },
    parsedId.data,
  );
  if (!result.ok) return { error: result.error };
  revalidateSellerCatalog();
  revalidatePath("/admin", "layout");
  return { success: "Produto enviado para aprovação." };
}

export async function updateProductAction(
  productId: string,
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) return { error: INVALID_PRODUCT };
  const revision = revisionSchema.safeParse(formData.get("revision"));
  if (!revision.success) return { error: "Recarregue a página antes de salvar o produto." };
  const parsed = parseProductForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados do produto." };
  if (new Set(parsed.data.variants.map((variant) => variant.sku.toLowerCase())).size !== parsed.data.variants.length) {
    return { error: "Cada variação precisa ter um SKU diferente." };
  }

  try {
    const updatedProductId = await updateSellerProduct(
      { sellerId: context.seller.id, storeId: context.store.id, userId: context.session.user.id },
      parsedId.data,
      parsed.data,
      { revision: revision.data },
    );
    revalidateSellerCatalog();
    revalidatePath(`/seller/products/${updatedProductId}/edit`);
    return { success: "Produto atualizado." };
  } catch (error) {
    const applicationError = toActionError(error, "updateProductAction");
    return {
      error:
        applicationError.code === "INTERNAL_ERROR"
          ? "Não foi possível atualizar o produto. Confira o slug e o SKU."
          : applicationError.message,
    };
  }
}

export async function archiveProductAction(productId: string): Promise<void> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) return;
  const archived = await archiveSellerProduct(
    { sellerId: context.seller.id, userId: context.session.user.id },
    parsedId.data,
  );
  if (archived) revalidateSellerCatalog();
}

export async function restoreProductAction(productId: string): Promise<void> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  const parsedId = productIdSchema.safeParse(productId);
  if (!parsedId.success) return;
  const restored = await restoreSellerProduct(
    { sellerId: context.seller.id, userId: context.session.user.id },
    parsedId.data,
  );
  if (restored) revalidateSellerCatalog();
}

const manualAdjustmentSchema = z.object({
  kind: z.enum(manualAdjustmentKinds, "Escolha o tipo de ajuste."),
  quantity: z.number("Informe uma quantidade em números inteiros."),
  note: z.string().trim().max(MANUAL_ADJUSTMENT_NOTE_MAX_LENGTH).optional(),
});

export async function adjustInventoryAction(variantId: string, input: unknown): Promise<ProductActionState> {
  const context = await requireSellerAccess("PRODUCT_UPDATE");
  if (!productIdSchema.safeParse(variantId).success) return { error: "Variação inválida." };
  const parsed = manualAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o ajuste de estoque." };
  const adjustmentError = validateManualAdjustment(parsed.data);
  if (adjustmentError) return { error: adjustmentError };
  try {
    await adjustInventoryManually({
      sellerId: context.seller.id,
      actorUserId: context.session.user.id,
      variantId,
      adjustment: parsed.data,
    });
    revalidateSellerCatalog();
    revalidatePath("/products");
    return { success: "Estoque atualizado." };
  } catch (error) {
    const applicationError = toActionError(error, "adjustInventoryAction");
    if (applicationError.code === "INVALID_INVENTORY_QUANTITY")
      return { error: "O ajuste deixaria o estoque negativo ou acima do limite permitido." };
    if (applicationError.code === "INTERNAL_ERROR") return { error: "Não foi possível atualizar o estoque." };
    return { error: applicationError.message };
  }
}

export async function approveProductAction(productId: string): Promise<ProductActionState> {
  const session = await requireAdminAccess();
  if (!productIdSchema.safeParse(productId).success) return { error: "Produto inválido." };
  const result = await approveSubmittedProduct({ userId: session.user.id }, productId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  revalidatePath("/products");
  return { success: "Produto aprovado." };
}

const MAX_REJECTION_REASON_LENGTH = 1000;

export async function rejectProductAction(productId: string, formData: FormData): Promise<ProductActionState> {
  const session = await requireAdminAccess();
  if (!productIdSchema.safeParse(productId).success) return { error: "Produto inválido." };
  const cleanReason = String(formData.get("reason") ?? "").trim();
  if (cleanReason.length < 5) return { error: "Informe o motivo da rejeição." };
  // O motivo é exibido ao lojista e copiado para a auditoria: sem limite, um payload forjado grava megabytes.
  if (cleanReason.length > MAX_REJECTION_REASON_LENGTH)
    return { error: `Use no máximo ${MAX_REJECTION_REASON_LENGTH} caracteres no motivo da rejeição.` };
  const result = await rejectSubmittedProduct({ userId: session.user.id }, productId, cleanReason);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  revalidateSellerCatalog();
  return { success: "Produto rejeitado." };
}
