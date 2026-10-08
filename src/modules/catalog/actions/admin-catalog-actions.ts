"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { slugify } from "@/lib/utils";
import { ApplicationError, asApplicationError } from "@/shared/errors/application-error";

// O slug público deriva do nome: um nome só com símbolos ("!!!") geraria slug vazio.
const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(120, "Use no máximo 120 caracteres.")
    .refine((name) => slugify(name).length > 0, "O nome precisa conter letras ou números."),
});
const categorySchema = nameSchema.extend({
  parentId: z.string().cuid().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
});
const modelSchema = nameSchema.extend({ manufacturerId: z.string().cuid() });
const fitmentSchema = z.object({
  motorcycleModelId: z.string().cuid(),
  version: z.string().trim().max(80),
  displacementCc: z.coerce.number().int().positive().max(10_000),
  year: z.coerce.number().int().min(1900).max(2_200),
});

export type CatalogActionState = { error?: string; success?: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function duplicateMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fallback;
  return asApplicationError(error).message;
}

export async function createCategoryAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = categorySchema.safeParse({
    name: value(formData, "name"),
    parentId: value(formData, "parentId") || undefined,
    sortOrder: value(formData, "sortOrder") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Categoria inválida." };

  try {
    if (parsed.data.parentId) {
      const parent = await db.category.findFirst({ where: { id: parsed.data.parentId, active: true } });
      if (!parent) return { error: "A categoria pai não está disponível." };
    }
    await db.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: parsed.data.name,
          slug: slugify(parsed.data.name),
          sortOrder: parsed.data.sortOrder,
          ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CATEGORY_CREATED",
          entityType: "CATEGORY",
          entityId: category.id,
          actorUserId: session.user.id,
          metadata: { name: category.name, parentId: category.parentId } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/seller/products/new");
    return { success: "Categoria criada." };
  } catch (error) {
    return { error: duplicateMessage(error, "Já existe uma categoria com este nome ou slug.") };
  }
}

export async function createBrandAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = nameSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Marca inválida." };

  try {
    await db.$transaction(async (tx) => {
      const brand = await tx.brand.create({ data: { name: parsed.data.name, slug: slugify(parsed.data.name) } });
      await tx.auditLog.create({
        data: {
          action: "BRAND_CREATED",
          entityType: "BRAND",
          entityId: brand.id,
          actorUserId: session.user.id,
          metadata: { name: brand.name } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/seller/products/new");
    return { success: "Marca criada." };
  } catch (error) {
    return { error: duplicateMessage(error, "Já existe uma marca com este nome ou slug.") };
  }
}

export async function createMotorcycleManufacturerAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = nameSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Fabricante inválido." };

  try {
    await db.$transaction(async (tx) => {
      const manufacturer = await tx.motorcycleManufacturer.create({
        data: { name: parsed.data.name, slug: slugify(parsed.data.name) },
      });
      await tx.auditLog.create({
        data: {
          action: "MOTORCYCLE_MANUFACTURER_CREATED",
          entityType: "MOTORCYCLE_MANUFACTURER",
          entityId: manufacturer.id,
          actorUserId: session.user.id,
          metadata: { name: manufacturer.name } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin", "layout");
    return { success: "Fabricante criado." };
  } catch (error) {
    return { error: duplicateMessage(error, "Já existe um fabricante com este nome ou slug.") };
  }
}

export async function createMotorcycleModelAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = modelSchema.safeParse({
    name: value(formData, "name"),
    manufacturerId: value(formData, "manufacturerId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Modelo inválido." };

  try {
    const manufacturer = await db.motorcycleManufacturer.findFirst({
      where: { id: parsed.data.manufacturerId, active: true },
    });
    if (!manufacturer) return { error: "O fabricante não está disponível." };
    await db.$transaction(async (tx) => {
      const model = await tx.motorcycleModel.create({
        data: {
          name: parsed.data.name,
          slug: slugify(parsed.data.name),
          manufacturerId: parsed.data.manufacturerId,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "MOTORCYCLE_MODEL_CREATED",
          entityType: "MOTORCYCLE_MODEL",
          entityId: model.id,
          actorUserId: session.user.id,
          metadata: { name: model.name, manufacturerId: model.manufacturerId } as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin", "layout");
    return { success: "Modelo criado." };
  } catch (error) {
    return { error: duplicateMessage(error, "Já existe este modelo para o fabricante selecionado.") };
  }
}

export async function createMotorcycleFitmentAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = fitmentSchema.safeParse({
    motorcycleModelId: value(formData, "motorcycleModelId"),
    version: value(formData, "version"),
    displacementCc: value(formData, "displacementCc"),
    year: value(formData, "year"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Fitment inválido." };

  try {
    const model = await db.motorcycleModel.findFirst({
      where: { id: parsed.data.motorcycleModelId, active: true, manufacturer: { active: true } },
    });
    if (!model) return { error: "O modelo não está disponível." };
    await db.$transaction(async (tx) => {
      const fitment = await tx.motorcycleFitment.create({ data: parsed.data });
      await tx.auditLog.create({
        data: {
          action: "MOTORCYCLE_FITMENT_CREATED",
          entityType: "MOTORCYCLE_FITMENT",
          entityId: fitment.id,
          actorUserId: session.user.id,
          metadata: parsed.data as Prisma.InputJsonValue,
        },
      });
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/products");
    revalidatePath("/seller/products/new");
    return { success: "Fitment criado." };
  } catch (error) {
    return { error: duplicateMessage(error, "Este fitment já existe para o modelo selecionado.") };
  }
}

/**
 * Sets the entry to `nextActive` (the state the admin clicked for). Repeating the same request — a
 * double click or two admins at once — is a no-op instead of flipping the entry back.
 */
export async function toggleCategoryAction(categoryId: string, nextActive: boolean): Promise<void> {
  const session = await requireAdminAccess();
  await db.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (!category) throw missingCatalogEntry();
    if (category.active === nextActive) return;
    const updated = await tx.category.updateMany({
      where: { id: category.id, active: !nextActive },
      data: { active: nextActive },
    });
    if (updated.count !== 1) throw staleCatalogDecision();
    await tx.auditLog.create({
      data: {
        action: !nextActive ? "CATEGORY_DEACTIVATED" : "CATEGORY_ACTIVATED",
        entityType: "CATEGORY",
        entityId: category.id,
        actorUserId: session.user.id,
        metadata: { active: nextActive } as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/seller/products/new");
}

/**
 * Sets the entry to `nextActive` (the state the admin clicked for). Repeating the same request — a
 * double click or two admins at once — is a no-op instead of flipping the entry back.
 */
export async function toggleBrandAction(brandId: string, nextActive: boolean): Promise<void> {
  const session = await requireAdminAccess();
  await db.$transaction(async (tx) => {
    const brand = await tx.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw missingCatalogEntry();
    if (brand.active === nextActive) return;
    const updated = await tx.brand.updateMany({
      where: { id: brand.id, active: !nextActive },
      data: { active: nextActive },
    });
    if (updated.count !== 1) throw staleCatalogDecision();
    await tx.auditLog.create({
      data: {
        action: !nextActive ? "BRAND_DEACTIVATED" : "BRAND_ACTIVATED",
        entityType: "BRAND",
        entityId: brand.id,
        actorUserId: session.user.id,
        metadata: { active: nextActive } as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/seller/products/new");
}

/**
 * Sets the entry to `nextActive` (the state the admin clicked for). Repeating the same request — a
 * double click or two admins at once — is a no-op instead of flipping the entry back.
 */
export async function toggleMotorcycleManufacturerAction(manufacturerId: string, nextActive: boolean): Promise<void> {
  const session = await requireAdminAccess();
  await db.$transaction(async (tx) => {
    const manufacturer = await tx.motorcycleManufacturer.findUnique({ where: { id: manufacturerId } });
    if (!manufacturer) throw missingCatalogEntry();
    if (manufacturer.active === nextActive) return;
    const updated = await tx.motorcycleManufacturer.updateMany({
      where: { id: manufacturer.id, active: !nextActive },
      data: { active: nextActive },
    });
    if (updated.count !== 1) throw staleCatalogDecision();
    await tx.auditLog.create({
      data: {
        action: !nextActive ? "MOTORCYCLE_MANUFACTURER_DEACTIVATED" : "MOTORCYCLE_MANUFACTURER_ACTIVATED",
        entityType: "MOTORCYCLE_MANUFACTURER",
        entityId: manufacturer.id,
        actorUserId: session.user.id,
        metadata: { active: nextActive } as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/products");
}

/**
 * Sets the entry to `nextActive` (the state the admin clicked for). Repeating the same request — a
 * double click or two admins at once — is a no-op instead of flipping the entry back.
 */
export async function toggleMotorcycleModelAction(modelId: string, nextActive: boolean): Promise<void> {
  const session = await requireAdminAccess();
  await db.$transaction(async (tx) => {
    const model = await tx.motorcycleModel.findUnique({ where: { id: modelId } });
    if (!model) throw missingCatalogEntry();
    if (model.active === nextActive) return;
    const updated = await tx.motorcycleModel.updateMany({
      where: { id: model.id, active: !nextActive },
      data: { active: nextActive },
    });
    if (updated.count !== 1) throw staleCatalogDecision();
    await tx.auditLog.create({
      data: {
        action: !nextActive ? "MOTORCYCLE_MODEL_DEACTIVATED" : "MOTORCYCLE_MODEL_ACTIVATED",
        entityType: "MOTORCYCLE_MODEL",
        entityId: model.id,
        actorUserId: session.user.id,
        metadata: { active: nextActive } as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/products");
}

function staleCatalogDecision() {
  return new ApplicationError({
    code: "CONFLICT",
    message: "Este cadastro mudou enquanto você o editava. Atualize a página e tente novamente.",
    statusCode: 409,
  });
}

function missingCatalogEntry() {
  return new ApplicationError({
    code: "NOT_FOUND",
    message: "Este cadastro não foi encontrado. Atualize a página e tente novamente.",
    statusCode: 404,
  });
}
