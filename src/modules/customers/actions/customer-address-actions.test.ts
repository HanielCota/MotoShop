import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  lock: vi.fn(),
  find: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: async () => ({ user: { id: "buyer" } }),
}));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.lock,
        customerAddress: {
          findFirst: mocks.find,
          updateMany: mocks.updateMany,
          update: mocks.update,
          delete: mocks.remove,
          count: mocks.count,
          create: mocks.create,
        },
      }),
  },
}));
import {
  setDefaultCustomerAddressAction,
  deleteCustomerAddressAction,
  createCustomerAddressAction,
} from "./customer-address-actions";
const addressId = "cmf8w8m4p0000s6o5zj2q8v3k";
beforeEach(() => vi.resetAllMocks());
it.each([setDefaultCustomerAddressAction, deleteCustomerAddressAction])(
  "locks the customer before looking up a mutable address",
  async (execute) => {
    mocks.find.mockResolvedValue(null);
    expect((await execute(addressId)).error).toContain("não encontrado");
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(defined(mocks.find.mock.invocationCallOrder[0]));
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: addressId, userId: "buyer" } });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  },
);
it("decides the initial default address only after locking the customer", async () => {
  mocks.count.mockResolvedValue(0);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    label: "Casa",
    recipient: "Cliente",
    postalCode: "01001000",
    street: "Rua Teste",
    number: "1",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
  }))
    form.set(key, value);
  expect((await createCustomerAddressAction({}, form)).success).toBeTruthy();
  expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(defined(mocks.count.mock.invocationCallOrder[0]));
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ isDefault: true, userId: "buyer" }) }),
  );
});

it("rejects an empty address before opening a transaction", async () => {
  const form = new FormData();
  form.set("label", "");

  expect((await createCustomerAddressAction({}, form)).error).toBe("Informe um nome para o endereço.");
  expect(mocks.lock).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it.each(["ZZ", "12", "S"])("rejects the invalid state code %s", async (state) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    label: "Casa",
    recipient: "Cliente",
    postalCode: "01001000",
    street: "Rua Teste",
    number: "1",
    neighborhood: "Centro",
    city: "São Paulo",
    state,
  }))
    form.set(key, value);

  expect((await createCustomerAddressAction({}, form)).error).toBe("Informe uma UF válida, como SP ou RJ.");
  expect(mocks.create).not.toHaveBeenCalled();
});

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Expected value to be defined");
  return value;
}
