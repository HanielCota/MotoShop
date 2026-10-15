"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { slugify } from "@/lib/utils";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { updateStoreProfile } from "../application/update-store-profile";
import { storeProfileSchema } from "../schemas/store-profile";

export type StoreProfileActionState = { error?: string; success?: string };

export async function updateStoreProfileAction(
  _previousState: StoreProfileActionState,
  formData: FormData,
): Promise<StoreProfileActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = storeProfileSchema.safeParse(readStoreProfileFormInput(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados da loja." };

  try {
    const scope = { storeId: context.store.id, sellerId: context.seller.id, actorUserId: context.session.user.id };
    const result = await updateStoreProfile(scope, parsed.data);
    if (!result) return { error: "Loja não encontrada." };

    revalidatePath("/seller", "layout");
    revalidatePath(`/loja/${result.previousSlug}`);
    revalidatePath(`/loja/${result.updatedStore.slug}`);
    revalidatePath("/sitemap.xml");
    return { success: "Perfil público atualizado." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Este identificador de loja já está em uso." };
    }
    return { error: asApplicationError(error).message };
  }
}

function readStoreProfileFormInput(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? "")),
    description: readTrimmedField(formData, "description"),
    instagramUrl: readTrimmedField(formData, "instagramUrl"),
    youtubeUrl: readTrimmedField(formData, "youtubeUrl"),
    whatsappUrl: readTrimmedField(formData, "whatsappUrl"),
    facebookUrl: readTrimmedField(formData, "facebookUrl"),
  };
}

function readTrimmedField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}
