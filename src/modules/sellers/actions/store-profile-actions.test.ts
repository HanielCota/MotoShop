import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const findFirst = vi.fn();
  const update = vi.fn();
  const auditCreate = vi.fn();
  return {
    findFirst,
    update,
    auditCreate,
    transaction: vi.fn(
      async (
        callback: (tx: {
          store: { findFirst: typeof findFirst; update: typeof update };
          auditLog: { create: typeof auditCreate };
        }) => Promise<unknown>,
      ) => callback({ store: { findFirst, update }, auditLog: { create: auditCreate } }),
    ),
    requireSellerAccess: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireSellerAccess: mocks.requireSellerAccess }));

import { updateStoreProfileAction } from "./store-profile-actions";

const oldStore = {
  id: "store-a",
  name: "Loja A",
  slug: "loja-a",
  description: null,
  instagramUrl: null,
  youtubeUrl: null,
  whatsappUrl: null,
  facebookUrl: null,
};

function profileForm(): FormData {
  const form = new FormData();
  form.set("name", "Loja A Off Road");
  form.set("slug", "loja-a-off-road");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSellerAccess.mockResolvedValue({
    seller: { id: "seller-a" },
    store: { id: "store-a" },
    session: { user: { id: "owner-a" } },
  });
  mocks.findFirst.mockResolvedValue(oldStore);
  mocks.update.mockResolvedValue({ ...oldStore, name: "Loja A Off Road", slug: "loja-a-off-road" });
});

describe("store profile authorization and audit", () => {
  it("checks the seller permission before accessing the store", async () => {
    mocks.requireSellerAccess.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(updateStoreProfileAction({}, profileForm())).rejects.toThrow("FORBIDDEN");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not update or audit another seller's store", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await updateStoreProfileAction({}, profileForm());

    expect(result.error).toBe("Loja não encontrada.");
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "store-a", sellerId: "seller-a" } }),
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("scopes the write and keeps the audit in the same transaction", async () => {
    const result = await updateStoreProfileAction({}, profileForm());

    expect(result.success).toBe("Perfil público atualizado.");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "store-a", sellerId: "seller-a" },
        data: expect.objectContaining({ name: "Loja A Off Road", slug: "loja-a-off-road" }),
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "STORE_PROFILE_UPDATED", entityId: "store-a", actorUserId: "owner-a" }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/loja/loja-a");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/loja/loja-a-off-road");
  });

  it("records the previous WhatsApp link in the audit snapshot", async () => {
    mocks.findFirst.mockResolvedValue({ ...oldStore, whatsappUrl: "https://wa.me/5511999999999" });

    await updateStoreProfileAction({}, profileForm());

    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          previous: expect.objectContaining({ whatsappUrl: "https://wa.me/5511999999999" }),
          current: expect.objectContaining({ whatsappUrl: null }),
        }),
      }),
    });
  });
});
