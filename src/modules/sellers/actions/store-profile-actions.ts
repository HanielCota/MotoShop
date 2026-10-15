"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { toActionError } from "@/shared/errors/action-error";

import { updateStoreProfile } from "../application/update-store-profile";
import { readStoreProfileFormInput, storeProfileSchema } from "../schemas/store-profile";
import { splitStoreSlugIssue } from "../schemas/store-slug";
import { readSubmittedValues } from "@/shared/forms/submitted-values";

const profileFields = [
  "name",
  "slug",
  "description",
  "instagramUrl",
  "youtubeUrl",
  "whatsappUrl",
  "facebookUrl",
] as const;

export type StoreProfileActionState = {
  error?: string;
  success?: string;
  slugError?: string;
  values?: Record<(typeof profileFields)[number], string>;
};

export async function updateStoreProfileAction(
  _previousState: StoreProfileActionState,
  formData: FormData,
): Promise<StoreProfileActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = storeProfileSchema.safeParse(readStoreProfileFormInput(formData));
  const values = readSubmittedValues(formData, profileFields);
  if (!parsed.success) return { ...splitStoreSlugIssue(parsed.error, "slug"), values };

  try {
    const scope = { storeId: context.store.id, sellerId: context.seller.id, actorUserId: context.session.user.id };
    const result = await updateStoreProfile(scope, parsed.data);
    if (!result) return { error: "Loja não encontrada.", values };

    revalidatePath("/seller", "layout");
    revalidatePath(`/loja/${result.previousSlug}`);
    revalidatePath(`/loja/${result.updatedStore.slug}`);
    revalidatePath("/sitemap.xml");
    return { success: "Perfil público atualizado." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { slugError: "Este identificador de loja já está em uso.", values };
    }
    return { error: toActionError(error, "updateStoreProfileAction").message, values };
  }
}
