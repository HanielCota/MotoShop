"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { slugify } from "@/lib/utils";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { asApplicationError } from "@/shared/errors/application-error";

import { storeProfileSchema } from "../schemas/store-profile";

export type StoreProfileActionState = { error?: string; success?: string };

export async function updateStoreProfileAction(
  _previousState: StoreProfileActionState,
  formData: FormData,
): Promise<StoreProfileActionState> {
  const context = await requireSellerAccess("SELLER_MANAGE");
  const parsed = storeProfileSchema.safeParse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") ?? "")),
    description: String(formData.get("description") ?? "").trim(),
    instagramUrl: String(formData.get("instagramUrl") ?? "").trim(),
    youtubeUrl: String(formData.get("youtubeUrl") ?? "").trim(),
    whatsappUrl: String(formData.get("whatsappUrl") ?? "").trim(),
    facebookUrl: String(formData.get("facebookUrl") ?? "").trim(),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados da loja." };

  try {
    const result = await db.$transaction(async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: context.store.id, sellerId: context.seller.id },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          instagramUrl: true,
          youtubeUrl: true,
          whatsappUrl: true,
          facebookUrl: true,
        },
      });
      if (!store) return null;

      const updatedStore = await tx.store.update({
        where: { id: store.id, sellerId: context.seller.id },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description || null,
          instagramUrl: parsed.data.instagramUrl || null,
          youtubeUrl: parsed.data.youtubeUrl || null,
          whatsappUrl: parsed.data.whatsappUrl || null,
          facebookUrl: parsed.data.facebookUrl || null,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          instagramUrl: true,
          youtubeUrl: true,
          whatsappUrl: true,
          facebookUrl: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "STORE_PROFILE_UPDATED",
          entityType: "STORE",
          entityId: updatedStore.id,
          actorUserId: context.session.user.id,
          metadata: {
            sellerId: context.seller.id,
            previous: {
              name: store.name,
              slug: store.slug,
              description: store.description,
              instagramUrl: store.instagramUrl,
              youtubeUrl: store.youtubeUrl,
              facebookUrl: store.facebookUrl,
            },
            current: {
              name: updatedStore.name,
              slug: updatedStore.slug,
              description: updatedStore.description,
              instagramUrl: updatedStore.instagramUrl,
              youtubeUrl: updatedStore.youtubeUrl,
              whatsappUrl: updatedStore.whatsappUrl,
              facebookUrl: updatedStore.facebookUrl,
            },
          } as Prisma.InputJsonValue,
        },
      });
      return { previousSlug: store.slug, updatedStore };
    });
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
