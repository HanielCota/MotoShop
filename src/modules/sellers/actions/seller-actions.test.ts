import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sellerCreate = vi.fn();
  const storeCreate = vi.fn();
  const memberCreate = vi.fn();
  return {
    membershipFindFirst: vi.fn(),
    sellerCreate,
    storeCreate,
    memberCreate,
    transaction: vi.fn(async (callback: (tx: {
      seller: { create: typeof sellerCreate };
      store: { create: typeof storeCreate };
      sellerMember: { create: typeof memberCreate };
    }) => Promise<unknown>) =>
      callback({
        seller: { create: sellerCreate },
        store: { create: storeCreate },
        sellerMember: { create: memberCreate },
      })),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({
  db: { sellerMember: { findFirst: mocks.membershipFindFirst }, $transaction: mocks.transaction },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-a" } })),
  requireSellerAccess: vi.fn(),
}));

import { createSellerAction } from "./seller-actions";

function onboardingForm() {
  const form = new FormData();
  form.set("storeName", "Loja de Desenvolvimento");
  form.set("storeSlug", "loja-de-desenvolvimento");
  form.set("originPostalCode", "01310100");
  form.set("type", "COMPANY");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.membershipFindFirst.mockResolvedValue(null);
  mocks.sellerCreate.mockResolvedValue({ id: "seller-a" });
  mocks.storeCreate.mockResolvedValue({ id: "store-a" });
  mocks.memberCreate.mockResolvedValue({ id: "member-a" });
});

describe("seller onboarding", () => {
  it("creates a pending seller, store and owner together", async () => {
    const result = await createSellerAction({}, onboardingForm());

    expect(result.success).toMatch(/solicitação enviada/i);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.sellerCreate).toHaveBeenCalledWith({ data: { type: "COMPANY", status: "PENDING" } });
    expect(mocks.storeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sellerId: "seller-a", slug: "loja-de-desenvolvimento" }),
    });
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: { sellerId: "seller-a", userId: "user-a", role: "OWNER" },
    });
  });

  it("does not create a second seller for an existing member", async () => {
    mocks.membershipFindFirst.mockResolvedValue({ id: "member-existing" });

    const result = await createSellerAction({}, onboardingForm());

    expect(result.error).toMatch(/já está vinculado/i);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
