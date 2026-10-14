import { beforeEach, expect, it, vi } from "vitest";

import { ApplicationError } from "@/shared/errors/application-error";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  assertRateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  logError: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=abc" }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: async () => ({ user: { id: "buyer" } }),
}));
vi.mock("@/modules/auth/infrastructure/auth", () => ({ auth: { api: { updateUser: mocks.updateUser } } }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: mocks.assertRateLimit }));
vi.mock("../application/update-customer-contact", () => ({ updateCustomerContact: mocks.updateContact }));

import { updateCustomerContactAction, updateCustomerNameAction } from "./customer-profile-actions";

beforeEach(() => vi.resetAllMocks());

it("updates the trimmed name through Better Auth with the request session", async () => {
  mocks.updateUser.mockResolvedValue({ status: true });

  expect(await updateCustomerNameAction({ name: "  Luiz Carlos  " })).toEqual({ success: "Nome atualizado." });
  expect(mocks.assertRateLimit).toHaveBeenCalledWith({ key: "update-profile:buyer", windowSeconds: 60, max: 5 });
  expect(mocks.updateUser).toHaveBeenCalledWith({ body: { name: "Luiz Carlos" }, headers: expect.any(Headers) });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/account/profile");
});

it.each([{ name: "" }, { name: "A" }, { name: "x".repeat(121) }, {}, null])(
  "rejects an invalid payload %j before touching Better Auth",
  async (input) => {
    const result = await updateCustomerNameAction(input);
    expect(result.error).toBeTruthy();
    expect(mocks.assertRateLimit).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  },
);

it("only forwards the name, ignoring extra fields such as the e-mail", async () => {
  mocks.updateUser.mockResolvedValue({ status: true });
  await updateCustomerNameAction({ name: "Luiz", email: "other@example.test" });
  expect(mocks.updateUser).toHaveBeenCalledWith({ body: { name: "Luiz" }, headers: expect.any(Headers) });
});

it("returns the rate-limit message without updating the user", async () => {
  mocks.assertRateLimit.mockRejectedValue(
    new ApplicationError({ code: "CONFLICT", statusCode: 429, message: "Muitas tentativas em pouco tempo." }),
  );
  expect(await updateCustomerNameAction({ name: "Luiz" })).toEqual({ error: "Muitas tentativas em pouco tempo." });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

it("hides Better Auth failures behind a friendly message", async () => {
  mocks.updateUser.mockRejectedValue(new Error("db down"));
  const result = await updateCustomerNameAction({ name: "Luiz" });
  expect(result.error).toBe("Não foi possível salvar seu nome agora. Tente novamente em instantes.");
  expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ event: "customer.profile_update_failed" }));
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});

it("saves CPF/CNPJ and phone as digits for the signed-in user only", async () => {
  expect(await updateCustomerContactAction({ taxId: "529.982.247-25", phone: "(11) 98765-4321" })).toEqual({
    success: "Dados atualizados.",
  });
  expect(mocks.updateContact).toHaveBeenCalledWith("buyer", { taxId: "52998224725", phone: "11987654321" });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/checkout");
});

it.each([
  [
    { taxId: null, phone: "11987654321" },
    { taxId: null, phone: "11987654321" },
  ],
  [
    { taxId: "52998224725", phone: null },
    { taxId: "52998224725", phone: null },
  ],
  [
    { taxId: null, phone: null },
    { taxId: null, phone: null },
  ],
])("saves what the profile form sends after its own validation (%j)", async (input, saved) => {
  expect(await updateCustomerContactAction(input)).toEqual({ success: "Dados atualizados." });
  expect(mocks.updateContact).toHaveBeenCalledWith("buyer", saved);
});

it("clears both optional fields when they are left empty", async () => {
  await updateCustomerContactAction({ taxId: " ", phone: "" });
  expect(mocks.updateContact).toHaveBeenCalledWith("buyer", { taxId: null, phone: null });
});

it.each([
  [{ taxId: "123.456.789-00", phone: "" }, "Informe um CPF ou CNPJ válido."],
  [{ taxId: "11.222.333/0001-80", phone: "" }, "Informe um CPF ou CNPJ válido."],
  [{ taxId: "", phone: "(01) 2345-678" }, "Informe um telefone com DDD, ex.: (11) 98765-4321."],
])("rejects invalid contact data %j before saving", async (input, message) => {
  expect(await updateCustomerContactAction(input)).toEqual({ error: message });
  expect(mocks.updateContact).not.toHaveBeenCalled();
});

it("logs a failed contact update without the CPF or phone", async () => {
  mocks.updateContact.mockRejectedValue(new Error("db down"));

  const result = await updateCustomerContactAction({ taxId: "52998224725", phone: "11987654321" });

  expect(result.error).toMatch(/Não foi possível salvar/);
  const logged = JSON.stringify(mocks.logError.mock.calls);
  expect(logged).not.toContain("52998224725");
  expect(logged).not.toContain("11987654321");
});
