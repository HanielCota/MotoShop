import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findCategory: vi.fn(),
  findBrand: vi.fn(),
  findManufacturer: vi.fn(),
  findModel: vi.fn(),
  findActiveManufacturer: vi.fn(),
  findActiveModel: vi.fn(),
  createCategory: vi.fn(),
  createBrand: vi.fn(),
  createManufacturer: vi.fn(),
  createModel: vi.fn(),
  createFitment: vi.fn(),
  updateCategory: vi.fn(),
  updateBrand: vi.fn(),
  updateManufacturer: vi.fn(),
  updateModel: vi.fn(),
  auditCreate: vi.fn(),
  revalidatePath: vi.fn(),
  adminAccess: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: mocks.transaction,
    motorcycleManufacturer: { findFirst: mocks.findActiveManufacturer },
    motorcycleModel: { findFirst: mocks.findActiveModel },
  },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAdminAccess: mocks.adminAccess,
}));

import {
  createBrandAction,
  createCategoryAction,
  createMotorcycleFitmentAction,
  createMotorcycleManufacturerAction,
  createMotorcycleModelAction,
  toggleBrandAction,
  toggleCategoryAction,
  toggleMotorcycleManufacturerAction,
  toggleMotorcycleModelAction,
} from "./admin-catalog-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminAccess.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      category: { findUnique: mocks.findCategory, updateMany: mocks.updateCategory, create: mocks.createCategory },
      brand: { findUnique: mocks.findBrand, updateMany: mocks.updateBrand, create: mocks.createBrand },
      motorcycleManufacturer: {
        findUnique: mocks.findManufacturer,
        updateMany: mocks.updateManufacturer,
        create: mocks.createManufacturer,
      },
      motorcycleModel: { findUnique: mocks.findModel, updateMany: mocks.updateModel, create: mocks.createModel },
      motorcycleFitment: { create: mocks.createFitment },
      auditLog: { create: mocks.auditCreate },
    }),
  );
  for (const find of [mocks.findCategory, mocks.findBrand, mocks.findManufacturer, mocks.findModel]) {
    find.mockResolvedValue({ id: "creference01", active: true });
  }
  for (const update of [mocks.updateCategory, mocks.updateBrand, mocks.updateManufacturer, mocks.updateModel]) {
    update.mockResolvedValue({ count: 1 });
  }
  for (const create of [
    mocks.createCategory,
    mocks.createBrand,
    mocks.createManufacturer,
    mocks.createModel,
    mocks.createFitment,
  ]) {
    create.mockResolvedValue({
      id: "creference01",
      name: "Referência",
      parentId: null,
      manufacturerId: "manufacturer-a",
    });
  }
  mocks.findActiveManufacturer.mockResolvedValue({ id: "manufacturer-a" });
  mocks.findActiveModel.mockResolvedValue({ id: "model-a" });
});

function creationForm(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("admin catalog creations", () => {
  const cases = [
    ["category", createCategoryAction, { name: "Referência" }, mocks.createCategory, "CATEGORY_CREATED"],
    ["brand", createBrandAction, { name: "Referência" }, mocks.createBrand, "BRAND_CREATED"],
    [
      "manufacturer",
      createMotorcycleManufacturerAction,
      { name: "Referência" },
      mocks.createManufacturer,
      "MOTORCYCLE_MANUFACTURER_CREATED",
    ],
    [
      "model",
      createMotorcycleModelAction,
      { name: "Referência", manufacturerId: "clabcdefghijklmnopqrstuvw" },
      mocks.createModel,
      "MOTORCYCLE_MODEL_CREATED",
    ],
    [
      "fitment",
      createMotorcycleFitmentAction,
      { motorcycleModelId: "clabcdefghijklmnopqrstuvw", version: "R", displacementCc: "250", year: "2025" },
      mocks.createFitment,
      "MOTORCYCLE_FITMENT_CREATED",
    ],
  ] as const;

  it.each(cases)(
    "creates %s and its audit record in one transaction",
    async (_name, action, input, create, auditAction) => {
      const result = await action({}, creationForm(input));

      expect(result.success).toBeTruthy();
      expect(mocks.transaction).toHaveBeenCalledOnce();
      expect(create).toHaveBeenCalledOnce();
      expect(mocks.auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: auditAction, actorUserId: "admin-a", entityId: "creference01" }),
      });
    },
  );
});

describe("admin catalog status transitions", () => {
  const cases = [
    ["category", toggleCategoryAction, mocks.updateCategory, "CATEGORY_DEACTIVATED"],
    ["brand", toggleBrandAction, mocks.updateBrand, "BRAND_DEACTIVATED"],
    [
      "manufacturer",
      toggleMotorcycleManufacturerAction,
      mocks.updateManufacturer,
      "MOTORCYCLE_MANUFACTURER_DEACTIVATED",
    ],
    ["model", toggleMotorcycleModelAction, mocks.updateModel, "MOTORCYCLE_MODEL_DEACTIVATED"],
  ] as const;

  it.each(cases)(
    "changes %s only from its observed state and audits in the transaction",
    async (_name, action, update, auditAction) => {
      await action("creference01", false);

      expect(mocks.transaction).toHaveBeenCalledOnce();
      expect(update).toHaveBeenCalledWith({
        where: { id: "creference01", active: true },
        data: { active: false },
      });
      expect(mocks.auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: auditAction, actorUserId: "admin-a", entityId: "creference01" }),
      });
    },
  );

  it.each(cases)("rejects a stale %s decision without writing an audit record", async (_name, action, update) => {
    update.mockResolvedValue({ count: 0 });

    await expect(action("creference01", false)).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it.each(cases)(
    "treats a repeated %s decision (double click) as a no-op instead of flipping it back",
    async (_name, action, update) => {
      // The entry is already inactive, which is exactly what the admin asked for again.
      await action("creference01", true);

      expect(update).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    },
  );

  const missingCases = [
    ["category", toggleCategoryAction, mocks.findCategory, mocks.updateCategory],
    ["brand", toggleBrandAction, mocks.findBrand, mocks.updateBrand],
    ["manufacturer", toggleMotorcycleManufacturerAction, mocks.findManufacturer, mocks.updateManufacturer],
    ["model", toggleMotorcycleModelAction, mocks.findModel, mocks.updateModel],
  ] as const;

  it.each(missingCases)("rejects a missing %s without reporting success", async (_name, action, find, update) => {
    find.mockResolvedValue(null);

    await expect(action("creference01", false)).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
    expect(update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(cases)("rejects a malformed %s id before opening a transaction", async (_name, action, update) => {
    await expect(action("../x", false)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Item do catálogo inválido.",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("denies mutation before reading the catalog when admin authorization fails", async () => {
    mocks.adminAccess.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(toggleCategoryAction("creference01", false)).rejects.toThrow("FORBIDDEN");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("admin catalog names", () => {
  it.each([
    ["category", createCategoryAction],
    ["brand", createBrandAction],
    ["manufacturer", createMotorcycleManufacturerAction],
  ] as const)("refuses a %s name that would produce an empty public slug", async (_name, action) => {
    const result = await action({}, creationForm({ name: "!!!" }));

    expect(result.error).toBe("O nome precisa conter letras ou números.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
