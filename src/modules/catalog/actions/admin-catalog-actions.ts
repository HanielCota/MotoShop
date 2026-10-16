"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/database";
import { requireAdminAccess } from "@/modules/auth/application/authorization";
import { slugify } from "@/lib/utils";
import { ApplicationError } from "@/shared/errors/application-error";
import { toActionError } from "@/shared/errors/action-error";
import { assertRecordId } from "@/shared/validation/record-id";

import {
  categorySchema,
  fitmentSchema,
  modelSchema,
  nameSchema,
  readCategoryInput,
  readFitmentInput,
  readModelInput,
  readNameInput,
} from "../schemas/catalog-input";

export type CatalogActionState = { error?: string; success?: string };

function duplicateMessage(error: unknown, fallback: string, action: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return fallback;
  return toActionError(error, action).message;
}

export async function createCategoryAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = categorySchema.safeParse(readCategoryInput(formData));
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
    return { error: duplicateMessage(error, "Já existe uma categoria com este nome ou slug.", "createCategoryAction") };
  }
}

export async function createBrandAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = nameSchema.safeParse(readNameInput(formData));
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
    return { error: duplicateMessage(error, "Já existe uma marca com este nome ou slug.", "createBrandAction") };
  }
}

export async function createMotorcycleManufacturerAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = nameSchema.safeParse(readNameInput(formData));
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
    return {
      error: duplicateMessage(
        error,
        "Já existe um fabricante com este nome ou slug.",
        "createMotorcycleManufacturerAction",
      ),
    };
  }
}

export async function createMotorcycleModelAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = modelSchema.safeParse(readModelInput(formData));
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
    return {
      error: duplicateMessage(
        error,
        "Já existe este modelo para o fabricante selecionado.",
        "createMotorcycleModelAction",
      ),
    };
  }
}

export async function createMotorcycleFitmentAction(
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const session = await requireAdminAccess();
  const parsed = fitmentSchema.safeParse(readFitmentInput(formData));
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
    return {
      error: duplicateMessage(
        error,
        "Este fitment já existe para o modelo selecionado.",
        "createMotorcycleFitmentAction",
      ),
    };
  }
}

/**
 * Sets the entry to `nextActive` (the state the admin clicked for). Repeating the same request — a
 * double click or two admins at once — is a no-op instead of flipping the entry back.
 */
export async function toggleCategoryAction(categoryId: string, nextActive: boolean): Promise<void> {
  const session = await requireAdminAccess();
  assertToggleInput(categoryId, nextActive);
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
 * Marks a category as fitting any motorcycle. Its products, and those of its subcategories,
 * pass the catalog motorcycle filter. Like the status toggles, repeating the request is a no-op.
 */
export async function setCategoryUniversalAction(categoryId: string, nextUniversal: boolean): Promise<void> {
  const session = await requireAdminAccess();
  assertToggleInput(categoryId, nextUniversal);
  await db.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (!category) throw missingCatalogEntry();
    if (category.universal === nextUniversal) return;

    const updated = await tx.category.updateMany({
      where: { id: category.id, universal: !nextUniversal },
      data: { universal: nextUniversal },
    });
    if (updated.count !== 1) throw staleCatalogDecision();

    await tx.auditLog.create({
      data: {
        action: nextUniversal ? "CATEGORY_UNIVERSAL_ENABLED" : "CATEGORY_UNIVERSAL_DISABLED",
        entityType: "CATEGORY",
        entityId: category.id,
        actorUserId: session.user.id,
        metadata: { universal: nextUniversal } as Prisma.InputJsonValue,
      },
    });
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/products", "layout");
}

/**
 * Sets the entry to `nextActive` (the state the admin clicked for). Repeating the same request — a
 * double click or two admins at once — is a no-op instead of flipping the entry back.
 */
export async function toggleBrandAction(brandId: string, nextActive: boolean): Promise<void> {
  const session = await requireAdminAccess();
  assertToggleInput(brandId, nextActive);
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
  assertToggleInput(manufacturerId, nextActive);
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
  assertToggleInput(modelId, nextActive);
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

function assertToggleInput(entryId: unknown, nextActive: unknown): asserts entryId is string {
  assertRecordId(entryId, "Item do catálogo inválido.");
  if (typeof nextActive === "boolean") return;

  throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Status inválido.", statusCode: 400 });
}
