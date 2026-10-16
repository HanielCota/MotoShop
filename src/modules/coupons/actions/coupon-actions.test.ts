import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const findFirst = vi.fn();
  const updateMany = vi.fn();
  const auditCreate = vi.fn();
  const couponCreate = vi.fn();
  return {
    couponCreate,
    findFirst,
    updateMany,
    auditCreate,
    transaction: vi.fn(
      async (
        callback: (tx: {
          coupon: { findFirst: typeof findFirst; updateMany: typeof updateMany; create: typeof couponCreate };
          auditLog: { create: typeof auditCreate };
        }) => Promise<unknown>,
      ) => callback({ coupon: { findFirst, updateMany, create: couponCreate }, auditLog: { create: auditCreate } }),
    ),
    requireSellerAccess: vi.fn(),
    requireAdminAccess: vi.fn(),
    setParticipation: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
const rateLimit = vi.hoisted(() => ({ assertRateLimit: vi.fn() }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: rateLimit.assertRateLimit }));
vi.mock("@/lib/database", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("../application/set-coupon-participation", () => ({ setCouponParticipation: mocks.setParticipation }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireSellerAccess: mocks.requireSellerAccess,
  requireAdminAccess: mocks.requireAdminAccess,
}));

import {
  createMarketplaceCouponAction,
  createSellerCouponAction,
  joinMarketplaceCouponAction,
  leaveMarketplaceCouponAction,
  setMarketplaceCouponActiveAction,
  setSellerCouponActiveAction,
  setSellerCouponProductPageAction,
} from "./coupon-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSellerAccess.mockResolvedValue({ seller: { id: "seller-a" }, session: { user: { id: "owner-a" } } });
  mocks.requireAdminAccess.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("coupon status authorization", () => {
  it("does not change a coupon absent from the current seller scope", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await setSellerCouponActiveAction("ccouponsellerb0000000002", false);

    expect(mocks.requireSellerAccess).toHaveBeenCalledWith("COUPON_MANAGE");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "ccouponsellerb0000000002", ownerType: "SELLER", sellerId: "seller-a" },
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("keeps the seller scope in the atomic write and audits an actual change", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ccoupona00000000000000001", code: "OFFROAD" });

    await setSellerCouponActiveAction("ccoupona00000000000000001", false);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "ccoupona00000000000000001", ownerType: "SELLER", sellerId: "seller-a", active: true },
      data: { active: false },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SELLER_COUPON_DEACTIVATED",
        entityId: "ccoupona00000000000000001",
        actorUserId: "owner-a",
      }),
    });
  });

  it("does not create an audit entry when the status was already changed", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ccoupona00000000000000001", code: "OFFROAD" });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await setSellerCouponActiveAction("ccoupona00000000000000001", false);

    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not touch the database when admin authorization fails", async () => {
    mocks.requireAdminAccess.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(setMarketplaceCouponActiveAction("ccoupona00000000000000001", false)).rejects.toThrow("FORBIDDEN");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("limits an admin status change to marketplace-owned coupons", async () => {
    mocks.findFirst.mockResolvedValue({ id: "ccouponglobal00000000003", code: "GLOBAL" });

    await setMarketplaceCouponActiveAction("ccouponglobal00000000003", true);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "ccouponglobal00000000003", ownerType: "MARKETPLACE", sellerId: null },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "ccouponglobal00000000003", ownerType: "MARKETPLACE", sellerId: null, active: false },
      data: { active: true },
    });
  });
});

describe("coupon creation audit", () => {
  function couponForm() {
    const form = new FormData();
    form.set("code", "trilha10");
    form.set("discountType", "PERCENTAGE");
    form.set("discountPercent", "10");
    form.set("minimumPurchase", "50");
    return form;
  }

  it("creates a seller coupon and its audit entry in one transaction", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-new" });

    const result = await createSellerCouponAction({}, couponForm());

    expect(result.success).toMatch(/TRILHA10/);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.couponCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "TRILHA10",
        ownerType: "SELLER",
        fundedBy: "SELLER",
        sellerId: "seller-a",
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "COUPON_CREATED",
        entityId: "coupon-new",
        actorUserId: "owner-a",
        metadata: expect.objectContaining({
          ownerType: "SELLER",
          fundedBy: "SELLER",
          sellerId: "seller-a",
          percentageBps: 1000,
          minimumPurchaseInCents: 5000,
        }),
      }),
    });
  });

  it("creates a seller-funded campaign by default and audits it with the admin as actor", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-global-new" });

    await createMarketplaceCouponAction({}, couponForm());

    expect(mocks.couponCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerType: "MARKETPLACE", fundedBy: "SELLER" }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "COUPON_CREATED",
        actorUserId: "admin-a",
        metadata: expect.objectContaining({ ownerType: "MARKETPLACE", fundedBy: "SELLER", sellerId: null }),
      }),
    });
  });

  it("creates a Moto Shop-paid coupon when the admin chooses it", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-global-paid" });
    const form = couponForm();
    form.set("couponKind", "MARKETPLACE");

    await createMarketplaceCouponAction({}, form);

    expect(mocks.couponCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerType: "MARKETPLACE", fundedBy: "MARKETPLACE" }),
    });
  });

  it("rejects an unknown coupon kind before touching the database", async () => {
    const form = couponForm();
    form.set("couponKind", "SELLER");

    expect(await createMarketplaceCouponAction({}, form)).toEqual({ error: "Escolha quem paga o desconto do cupom." });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("ignores malformed coupon ids before touching the database", async () => {
    await setSellerCouponActiveAction("not a cuid", true);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("coupon creation bounds", () => {
  function couponForm(fields: Record<string, string>) {
    const form = new FormData();
    for (const [name, value] of Object.entries({ code: "LIMITE10", discountType: "FIXED_AMOUNT", ...fields }))
      form.set(name, value);
    return form;
  }

  it.each([
    [{ discountAmount: "99999999999" }, "desconto informado é maior"],
    [{ discountAmount: "10", minimumPurchase: "99999999999" }, "compra mínima informada é maior"],
    [{ discountAmount: "10", globalUsageLimit: "99999999999" }, "limite de uso informado é maior"],
    [{ discountAmount: "10", perCustomerUsageLimit: "1.5" }, "número inteiro"],
    [{ discountType: "FREE_SHIPPING", discountAmount: "10" }, "tipo de desconto"],
  ])("rejects out-of-range values before the int4 database columns (%o)", async (fields, message) => {
    const result = await createSellerCouponAction({}, couponForm(fields));
    expect(result.error).toContain(message);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("campaign participation", () => {
  const campaignId = "ccampaign00000000000001";

  it.each([
    [joinMarketplaceCouponAction, true, "Sua loja entrou na campanha."],
    [leaveMarketplaceCouponAction, false, "Sua loja saiu da campanha."],
  ])("uses the signed-in seller and COUPON_MANAGE (participate=%s)", async (action, participate, message) => {
    mocks.setParticipation.mockResolvedValue({ changed: true });

    expect(await action(campaignId)).toEqual({ success: message });

    expect(mocks.requireSellerAccess).toHaveBeenCalledWith("COUPON_MANAGE");
    expect(mocks.setParticipation).toHaveBeenCalledWith({
      sellerId: "seller-a",
      userId: "owner-a",
      couponId: campaignId,
      participate,
    });
  });

  it("ignores malformed campaign ids before touching the database", async () => {
    expect(await joinMarketplaceCouponAction("not a cuid")).toEqual({ error: "Campanha inválida." });
    expect(mocks.setParticipation).not.toHaveBeenCalled();
  });

  it("returns the domain message when the campaign is closed", async () => {
    const { ApplicationError } = await import("@/shared/errors/application-error");
    mocks.setParticipation.mockRejectedValue(
      new ApplicationError({ code: "CONFLICT", message: "Esta campanha não está mais disponível para adesão." }),
    );

    expect(await joinMarketplaceCouponAction(campaignId)).toEqual({
      error: "Esta campanha não está mais disponível para adesão.",
    });
  });
});

describe("coupon product page opt-in", () => {
  const couponId = "cmf8w8m4p0000s6o5zj2q8v3k";

  function creationForm(extra: Record<string, string> = {}) {
    const form = new FormData();
    form.set("code", "TRILHA10");
    form.set("discountType", "PERCENTAGE");
    form.set("discountPercent", "10");
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return form;
  }

  it("creates a seller coupon hidden from the product page unless the seller ticks the box", async () => {
    mocks.couponCreate.mockResolvedValue({ id: couponId });

    await createSellerCouponAction({}, creationForm());
    await createSellerCouponAction({}, creationForm({ showOnProductPage: "on" }));

    expect(mocks.couponCreate.mock.calls[0]?.[0].data.showOnProductPage).toBe(false);
    expect(mocks.couponCreate.mock.calls[1]?.[0].data.showOnProductPage).toBe(true);
  });

  it("never shows a marketplace coupon on the product page", async () => {
    mocks.couponCreate.mockResolvedValue({ id: couponId });

    await createMarketplaceCouponAction({}, creationForm({ showOnProductPage: "on" }));

    expect(mocks.couponCreate.mock.calls[0]?.[0].data.showOnProductPage).toBe(false);
  });

  it("toggles only a coupon of the current seller and audits the change", async () => {
    mocks.findFirst.mockResolvedValue({ id: couponId, code: "TRILHA10" });

    await setSellerCouponProductPageAction(couponId, true);

    expect(mocks.requireSellerAccess).toHaveBeenCalledWith("COUPON_MANAGE");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: couponId, ownerType: "SELLER", sellerId: "seller-a" },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: couponId, ownerType: "SELLER", sellerId: "seller-a", showOnProductPage: false },
      data: { showOnProductPage: true },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SELLER_COUPON_SHOWN_ON_PRODUCT_PAGE", actorUserId: "owner-a" }),
    });
  });

  it("does not touch a coupon from another seller", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await setSellerCouponProductPageAction(couponId, true);

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("requires COUPON_MANAGE before reading the coupon", async () => {
    mocks.requireSellerAccess.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(setSellerCouponProductPageAction(couponId, true)).rejects.toThrow("FORBIDDEN");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("coupon code oracle (L-10)", () => {
  function codeForm(code: string) {
    const form = new FormData();
    form.set("code", code);
    form.set("discountType", "PERCENTAGE");
    form.set("discountPercent", "10");
    return form;
  }

  it("answers a taken code with a neutral message that does not reveal its owner", async () => {
    const { Prisma } = await import("@/generated/prisma/client");
    mocks.couponCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }),
    );

    const result = await createSellerCouponAction({}, codeForm("BLACKFRIDAY"));

    expect(result.error).toBe("Este código não está disponível. Escolha outro.");
  });

  it("limits coupon creation per store before touching the database", async () => {
    const { ApplicationError } = await import("@/shared/errors/application-error");
    rateLimit.assertRateLimit.mockRejectedValueOnce(
      new ApplicationError({ code: "CONFLICT", statusCode: 429, message: "Muitas tentativas em pouco tempo." }),
    );

    const result = await createSellerCouponAction({}, codeForm("TESTE10"));

    expect(result.error).toBe("Muitas tentativas em pouco tempo.");
    expect(rateLimit.assertRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "seller-coupon-create:seller-a" }),
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("coupon validity dates (BUG-025)", () => {
  function couponForm(dates: { startsAt?: string; endsAt?: string }) {
    const form = new FormData();
    form.set("code", "natal10");
    form.set("discountType", "PERCENTAGE");
    form.set("discountPercent", "10");
    for (const [name, value] of Object.entries(dates)) form.set(name, value);
    return form;
  }

  it("saves the start and end typed by the seller, in Brasília time", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-new" });

    const result = await createSellerCouponAction({}, couponForm({ startsAt: "01/12/2099", endsAt: "31/12/2099" }));

    expect(result.success).toMatch(/NATAL10/);
    expect(mocks.couponCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sellerId: "seller-a",
        startsAt: new Date("2099-12-01T03:00:00.000Z"),
        endsAt: new Date("2100-01-01T02:59:59.999Z"),
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          startsAt: "2099-12-01T03:00:00.000Z",
          endsAt: "2100-01-01T02:59:59.999Z",
        }),
      }),
    });
  });

  it("saves the dates of an Admin campaign too", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-new" });

    await createMarketplaceCouponAction({}, couponForm({ endsAt: "31/12/2099" }));

    const data = mocks.couponCreate.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({ ownerType: "MARKETPLACE", endsAt: new Date("2100-01-01T02:59:59.999Z") });
    expect(data).not.toHaveProperty("startsAt");
  });

  it("keeps a coupon without dates open on both ends", async () => {
    mocks.couponCreate.mockResolvedValue({ id: "coupon-new" });

    await createSellerCouponAction({}, couponForm({ startsAt: "", endsAt: "" }));

    const data = mocks.couponCreate.mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("startsAt");
    expect(data).not.toHaveProperty("endsAt");
  });

  it("refuses an end before the start without touching the database", async () => {
    const result = await createSellerCouponAction({}, couponForm({ startsAt: "10/12/2099", endsAt: "01/12/2099" }));

    expect(result.error).toMatch(/não pode ser antes do início/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses a date that does not exist", async () => {
    const result = await createSellerCouponAction({}, couponForm({ endsAt: "31/02/2099" }));

    expect(result.error).toMatch(/Informe o fim como dia\/mês\/ano/);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
