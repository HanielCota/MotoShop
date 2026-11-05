import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  find: vi.fn(),
  upsert: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
  updateCompanyContact: vi.fn(),
  updateMarketplaceLimits: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: mocks.authorize }));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        marketplaceConfiguration: { findUnique: mocks.find, upsert: mocks.upsert },
        auditLog: { create: mocks.audit },
      }),
  },
}));

vi.mock("../application/company-contact", () => ({ updateCompanyContact: mocks.updateCompanyContact }));
vi.mock("../application/marketplace-limits", () => ({ updateMarketplaceLimits: mocks.updateMarketplaceLimits }));

import { ApplicationError } from "@/shared/errors/application-error";

import {
  updateCompanyContactAction,
  updateMarketplaceCommissionAction,
  updateMarketplaceLimitsAction,
} from "./marketplace-configuration-actions";

function form(value?: string) {
  const data = new FormData();
  if (value !== undefined) data.set("commissionPercent", value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.find.mockResolvedValue({ defaultCommissionBps: 1200 });
});

describe("marketplace default commission", () => {
  it.each([undefined, "", "-1", "100,01", "1,555", "abc"])(
    "rejects an absent or invalid percentage: %s",
    async (value) => {
      expect((await updateMarketplaceCommissionAction({}, form(value))).error).toBeTruthy();
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );

  it("allows an explicit zero and audits the prior value in the same transaction", async () => {
    expect((await updateMarketplaceCommissionAction({}, form("0"))).success).toBeTruthy();
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "default" },
      create: { key: "default", defaultCommissionBps: 0 },
      update: { defaultCommissionBps: 0 },
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "admin-a",
        metadata: { previousCommissionBps: 1200, nextCommissionBps: 0 },
      }),
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/admin", "layout");
  });

  it("returns the typed percentage so the form keeps it after a refusal", async () => {
    expect(await updateMarketplaceCommissionAction({}, form("150"))).toEqual({
      error: "Informe uma comissão entre 0% e 100%.",
      values: { commissionPercent: "150" },
    });
  });

  it("stores the percentage typed by the admin as basis points", async () => {
    expect((await updateMarketplaceCommissionAction({}, form("12,50"))).success).toBeTruthy();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { defaultCommissionBps: 1250 } }));
  });

  it("does not report success when persistence fails", async () => {
    mocks.upsert.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await updateMarketplaceCommissionAction({}, form("15"))).error).toBeTruthy();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("requires admin permission", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(updateMarketplaceCommissionAction({}, form("15"))).rejects.toThrow("FORBIDDEN");
    expect(mocks.find).not.toHaveBeenCalled();
  });
});

describe("company and contact", () => {
  const blankForm = {
    companyLegalName: "",
    companyCnpj: "",
    supportEmail: "",
    supportPhone: "",
    instagramUrl: "",
    youtubeUrl: "",
    weekdayHours: "",
    saturdayHours: "",
    sundayHolidayHours: "",
  };

  it("validates on the server and saves nothing when a field is wrong", async () => {
    const result = await updateCompanyContactAction({ ...blankForm, supportPhone: "123" });

    expect(result).toEqual({ error: "Informe o telefone com DDD." });
    expect(mocks.updateCompanyContact).not.toHaveBeenCalled();
  });

  it("saves the parsed values for the signed-in admin and refreshes the site footer", async () => {
    mocks.updateCompanyContact.mockResolvedValue({ changed: true });

    const result = await updateCompanyContactAction({ ...blankForm, supportPhone: "(11) 91234-5678" });

    expect(result.success).toBeTruthy();
    expect(mocks.updateCompanyContact).toHaveBeenCalledWith(
      "admin-a",
      expect.objectContaining({ supportPhone: "11912345678", companyLegalName: null }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("shows the conflict message when the default commission was never saved", async () => {
    mocks.updateCompanyContact.mockRejectedValue(
      new ApplicationError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Salve a comissão padrão antes de preencher empresa e contato.",
      }),
    );

    const result = await updateCompanyContactAction(blankForm);

    expect(result).toEqual({ error: "Salve a comissão padrão antes de preencher empresa e contato." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("requires admin permission before reading the input", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(updateCompanyContactAction(blankForm)).rejects.toThrow("FORBIDDEN");
    expect(mocks.updateCompanyContact).not.toHaveBeenCalled();
  });
});

describe("marketplace limits", () => {
  const blankLimits = {
    productPhotoLimit: "",
    photoMaxSizeInMegabytes: "",
    returnPhotoLimit: "",
    lastUnitsThreshold: "",
    lowStockThreshold: "",
    newProductDays: "",
    sellerInviteTtlDays: "",
  };

  it("validates on the server and saves nothing when a limit is out of range", async () => {
    const result = await updateMarketplaceLimitsAction({ ...blankLimits, productPhotoLimit: "20" });

    expect(result.error).toMatch(/Fotos por produto/);
    expect(mocks.updateMarketplaceLimits).not.toHaveBeenCalled();
  });

  it("saves the parsed limits for the signed-in admin and refreshes the whole site", async () => {
    mocks.updateMarketplaceLimits.mockResolvedValue({ changed: true });

    const result = await updateMarketplaceLimitsAction({ ...blankLimits, returnPhotoLimit: "5" });

    expect(result.success).toBeTruthy();
    expect(mocks.updateMarketplaceLimits).toHaveBeenCalledWith(
      "admin-a",
      expect.objectContaining({ returnPhotoLimit: 5, productPhotoLimit: null }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });

  it("tells the admin nothing changed and refreshes nothing", async () => {
    mocks.updateMarketplaceLimits.mockResolvedValue({ changed: false });

    const result = await updateMarketplaceLimitsAction(blankLimits);

    expect(result).toEqual({ success: "Nada mudou: os limites continuam iguais." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("requires admin permission before reading the input", async () => {
    mocks.authorize.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(updateMarketplaceLimitsAction(blankLimits)).rejects.toThrow("FORBIDDEN");
    expect(mocks.updateMarketplaceLimits).not.toHaveBeenCalled();
  });
});
