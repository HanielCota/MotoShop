import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  discardedPasswords: 1,
  updateMany: vi.fn((args: unknown) => ({ op: "account.updateMany", args })),
  deleteMany: vi.fn((args: unknown) => ({ op: "session.deleteMany", args })),
  transaction: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/config/env", () => ({ env: { ADMIN_EMAILS: "dono@motoshop.test, Admin2@Motoshop.test" } }));
vi.mock("@/lib/logger", () => ({ logger: { info: mocks.info, error: mocks.error } }));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: mocks.transaction,
    account: { updateMany: mocks.updateMany },
    session: { deleteMany: mocks.deleteMany },
  },
}));

import { secureAdminAccountAfterVerification } from "./secure-admin-account";

const requestPasswordReset = vi.fn(async (_email: string) => ({ status: true }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.discardedPasswords = 1;
  mocks.transaction.mockImplementation(async () => [{ count: mocks.discardedPasswords }, { count: 1 }]);
});

it("discards the password and ends the sessions of a newly verified admin e-mail (L-19)", async () => {
  await secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" }, requestPasswordReset);

  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { userId: "user-1", providerId: "credential", password: { not: null } },
    data: { password: null },
  });
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(JSON.stringify([...mocks.info.mock.calls, ...mocks.error.mock.calls])).not.toContain("admin2@motoshop.test");
});

// Regression: the admin's password was discarded with no way back in from the login page, so the
// reset link now goes to the inbox the admin has just proved it controls.
it("asks for exactly one reset e-mail when a verified admin's password is discarded", async () => {
  await secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" }, requestPasswordReset);

  expect(requestPasswordReset).toHaveBeenCalledOnce();
  expect(requestPasswordReset).toHaveBeenCalledWith("admin2@motoshop.test");
});

it("sends no second reset e-mail when there was no password left to discard", async () => {
  mocks.discardedPasswords = 0;

  await secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" }, requestPasswordReset);

  expect(requestPasswordReset).not.toHaveBeenCalled();
});

it("leaves customer and seller accounts alone and sends them no reset e-mail", async () => {
  await secureAdminAccountAfterVerification({ id: "user-2", email: "cliente@motoshop.test" }, requestPasswordReset);

  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(requestPasswordReset).not.toHaveBeenCalled();
});

it("keeps the verification working when the reset e-mail fails, and logs no e-mail address", async () => {
  requestPasswordReset.mockRejectedValueOnce(new Error("provider down"));

  await expect(
    secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" }, requestPasswordReset),
  ).resolves.toBeUndefined();

  expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ event: "auth.admin_password_reset_failed" }));
  expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("admin2@motoshop.test");
});

it("logs the reset only when a password was discarded, and calls it a request rather than a delivery", async () => {
  await secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" }, requestPasswordReset);
  mocks.discardedPasswords = 0;
  await secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" }, requestPasswordReset);

  const events = mocks.info.mock.calls.map(([entry]) => (entry as { event: string }).event);
  expect(events).toEqual(["auth.admin_password_reset_required", "auth.admin_password_reset_requested"]);
});
