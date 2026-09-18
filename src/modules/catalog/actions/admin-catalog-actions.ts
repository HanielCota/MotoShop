"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { slugify } from "@/lib/utils";
import { asApplicationError } from "@/shared/errors/application-error";

const nameSchema = z.object({ name: z.string().trim().min(2).max(120) });
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
    const category = await db.category.create({
      data: {
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        sortOrder: parsed.data.sortOrder,
        ...(parsed.data.parentId ? { parentId: parsed.data.parentId } : {}),
      },
    });
    await db.auditLog.create({
      data: {
        action: "CATEGORY_CREATED",
        entityType: "CATEGORY",
        entityId: category.id,
        actorUserId: session.user.id,
        metadata: { name: category.name, parentId: category.parentId } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/admin");
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
    const brand = await db.brand.create({ data: { name: parsed.data.name, slug: slugify(parsed.data.name) } });
    await db.auditLog.create({
      data: {
        action: "BRAND_CREATED",
        entityType: "BRAND",
        entityId: brand.id,
        actorUserId: session.user.id,
        metadata: { name: brand.name } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/admin");
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
    const manufacturer = await db.motorcycleManufacturer.create({
      data: { name: parsed.data.name, slug: slugify(parsed.data.name) },
    });
    await db.auditLog.create({
      data: {
        action: "MOTORCYCLE_MANUFACTURER_CREATED",
        entityType: "MOTORCYCLE_MANUFACTURER",
        entityId: manufacturer.id,
        actorUserId: session.user.id,
        metadata: { name: manufacturer.name } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/admin");
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
    const model = await db.motorcycleModel.create({
      data: {
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        manufacturerId: parsed.data.manufacturerId,
      },
    });
    await db.auditLog.create({
      data: {
        action: "MOTORCYCLE_MODEL_CREATED",
        entityType: "MOTORCYCLE_MODEL",
        entityId: model.id,
        actorUserId: session.user.id,
        metadata: { name: model.name, manufacturerId: model.manufacturerId } as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/admin");
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
    const fitment = await db.motorcycleFitment.create({ data: parsed.data });
    await db.auditLog.create({
      data: {
        action: "MOTORCYCLE_FITMENT_CREATED",
        entityType: "MOTORCYCLE_FITMENT",
        entityId: fitment.id,
        actorUserId: session.user.id,
        metadata: parsed.data as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/admin");
    revalidatePath("/products");
    revalidatePath("/seller/products/new");
    return { success: "Fitment criado." };
  } catch (error) {
    return { error: duplicateMessage(error, "Este fitment já existe para o modelo selecionado.") };
  }
}

export async function toggleCategoryAction(categoryId: string): Promise<void> {
  const session = await requireAdminAccess();
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) return;
  await db.category.update({ where: { id: category.id }, data: { active: !category.active } });
  await db.auditLog.create({
    data: {
      action: category.active ? "CATEGORY_DEACTIVATED" : "CATEGORY_ACTIVATED",
      entityType: "CATEGORY",
      entityId: category.id,
      actorUserId: session.user.id,
      metadata: { active: !category.active } as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/seller/products/new");
}

export async function toggleBrandAction(brandId: string): Promise<void> {
  const session = await requireAdminAccess();
  const brand = await db.brand.findUnique({ where: { id: brandId } });
  if (!brand) return;
  await db.brand.update({ where: { id: brand.id }, data: { active: !brand.active } });
  await db.auditLog.create({
    data: {
      action: brand.active ? "BRAND_DEACTIVATED" : "BRAND_ACTIVATED",
      entityType: "BRAND",
      entityId: brand.id,
      actorUserId: session.user.id,
      metadata: { active: !brand.active } as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/seller/products/new");
}

export async function toggleMotorcycleManufacturerAction(manufacturerId: string): Promise<void> {
  const session = await requireAdminAccess();
  const manufacturer = await db.motorcycleManufacturer.findUnique({ where: { id: manufacturerId } });
  if (!manufacturer) return;
  await db.motorcycleManufacturer.update({ where: { id: manufacturer.id }, data: { active: !manufacturer.active } });
  await db.auditLog.create({
    data: {
      action: manufacturer.active ? "MOTORCYCLE_MANUFACTURER_DEACTIVATED" : "MOTORCYCLE_MANUFACTURER_ACTIVATED",
      entityType: "MOTORCYCLE_MANUFACTURER",
      entityId: manufacturer.id,
      actorUserId: session.user.id,
      metadata: { active: !manufacturer.active } as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/products");
}

export async function toggleMotorcycleModelAction(modelId: string): Promise<void> {
  const session = await requireAdminAccess();
  const model = await db.motorcycleModel.findUnique({ where: { id: modelId } });
  if (!model) return;
  await db.motorcycleModel.update({ where: { id: model.id }, data: { active: !model.active } });
  await db.auditLog.create({
    data: {
      action: model.active ? "MOTORCYCLE_MODEL_DEACTIVATED" : "MOTORCYCLE_MODEL_ACTIVATED",
      entityType: "MOTORCYCLE_MODEL",
      entityId: model.id,
      actorUserId: session.user.id,
      metadata: { active: !model.active } as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/products");
}
