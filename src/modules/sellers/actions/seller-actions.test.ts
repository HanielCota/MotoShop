import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const sellerCreate = vi.fn();
  const storeCreate = vi.fn();
  const memberCreate = vi.fn();
  const lockUser = vi.fn();
  const storeFindFirst = vi.fn();
  const storeUpdate = vi.fn();
  const auditCreate = vi.fn();
  return {
    storeFindFirst,
    storeUpdate,
    auditCreate,
    membershipFindFirst: vi.fn(),
    lockUser,
    sellerCreate,
    storeCreate,
    memberCreate,
    transaction: vi.fn(
      async (
        callback: (tx: {
          seller: { create: typeof sellerCreate };
          store: { create: typeof storeCreate; findFirst: typeof storeFindFirst; update: typeof storeUpdate };
          auditLog: { create: typeof auditCreate };
          sellerMember: { create: typeof memberCreate; findFirst: ReturnType<typeof vi.fn> };
          $queryRaw: typeof lockUser;
        }) => Promise<unknown>,
      ) =>
        callback({
          seller: { create: sellerCreate },
          store: { create: storeCreate, findFirst: storeFindFirst, update: storeUpdate },
          auditLog: { create: auditCreate },
          sellerMember: { create: memberCreate, findFirst: mocks.membershipFindFirst },
          $queryRaw: lockUser,
        }),
    ),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/database", () => ({
  db: { $transaction: mocks.transaction },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-a" } })),
  requireSellerAccess: vi.fn(async () => ({
    session: { user: { id: "user-a" } },
    seller: { id: "seller-a" },
    store: { id: "store-a" },
  })),
}));

import { createSellerAction, updateShippingOriginAction } from "./seller-actions";

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
    expect(mocks.lockUser).toHaveBeenCalledOnce();
    expect(defined(mocks.lockUser.mock.invocationCallOrder[0])).toBeLessThan(
      defined(mocks.membershipFindFirst.mock.invocationCallOrder[0]),
    );
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
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.lockUser).toHaveBeenCalledOnce();
    expect(mocks.sellerCreate).not.toHaveBeenCalled();
  });
});

describe("shipping origin update", () => {
  function originForm() {
    const form = new FormData();
    form.set("originName", "Loja Teste");
    form.set("originEmail", "loja@example.test");
    form.set("originPhone", "11999990000");
    form.set("originDocument", "123.456.789-01");
    form.set("originPostalCode", "01310-100");
    form.set("originStreet", "Avenida Paulista");
    form.set("originNumber", "1000");
    form.set("originNeighborhood", "Bela Vista");
    form.set("originCity", "São Paulo");
    form.set("originState", "sp");
    return form;
  }

  it("updates the origin and audits before/after with the document masked", async () => {
    mocks.storeFindFirst.mockResolvedValue({
      originName: "Antiga",
      originEmail: null,
      originPhone: null,
      originDocument: "98765432100",
      originPostalCode: "01000000",
      originStreet: null,
      originNumber: null,
      originComplement: null,
      originNeighborhood: null,
      originCity: null,
      originState: null,
      originStateRegister: null,
    });

    const result = await updateShippingOriginAction({}, originForm());

    expect(result.success).toBeDefined();
    expect(mocks.storeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "store-a", sellerId: "seller-a" } }),
    );
    expect(mocks.storeUpdate).toHaveBeenCalledWith({
      where: { id: "store-a", sellerId: "seller-a" },
      data: expect.objectContaining({ originDocument: "12345678901", originState: "SP" }),
    });
    const audit = defined(mocks.auditCreate.mock.calls[0])[0] as { data: { action: string; metadata: unknown } };
    expect(audit.data.action).toBe("STORE_SHIPPING_ORIGIN_UPDATED");
    expect(audit.data.metadata).toMatchObject({
      sellerId: "seller-a",
      previous: { originName: "Antiga", originDocument: "*********00" },
      next: { originName: "Loja Teste", originDocument: "*********01" },
    });
    expect(JSON.stringify(audit.data.metadata)).not.toContain("12345678901");
  });
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
