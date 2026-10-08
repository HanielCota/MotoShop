import { beforeEach, expect, it, vi } from "vitest";

import { ApplicationError } from "@/shared/errors/application-error";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  assertRateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "session=abc" }) }));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: async () => ({ user: { id: "buyer" } }),
}));
vi.mock("@/modules/auth/infrastructure/auth", () => ({ auth: { api: { updateUser: mocks.updateUser } } }));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: mocks.assertRateLimit }));

import { updateCustomerNameAction } from "./customer-profile-actions";

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
