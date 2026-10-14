import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  updateMany: vi.fn((args: unknown) => ({ op: "account.updateMany", args })),
  deleteMany: vi.fn((args: unknown) => ({ op: "session.deleteMany", args })),
  transaction: vi.fn(async (operations: unknown[]) => operations),
  info: vi.fn(),
}));
vi.mock("@/config/env", () => ({ env: { ADMIN_EMAILS: "dono@motoshop.test, Admin2@Motoshop.test" } }));
vi.mock("@/lib/logger", () => ({ logger: { info: mocks.info } }));
vi.mock("@/lib/database", () => ({
  db: {
    $transaction: mocks.transaction,
    account: { updateMany: mocks.updateMany },
    session: { deleteMany: mocks.deleteMany },
  },
}));

import { secureAdminAccountAfterVerification } from "./secure-admin-account";

beforeEach(() => vi.clearAllMocks());

it("discards the password and ends the sessions of a newly verified admin e-mail (L-19)", async () => {
  await secureAdminAccountAfterVerification({ id: "user-1", email: "admin2@motoshop.test" });

  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { userId: "user-1", providerId: "credential" },
    data: { password: null },
  });
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  expect(mocks.transaction).toHaveBeenCalledOnce();
  expect(JSON.stringify(mocks.info.mock.calls)).not.toContain("admin2@motoshop.test");
});

it("leaves customer and seller accounts alone", async () => {
  await secureAdminAccountAfterVerification({ id: "user-2", email: "cliente@motoshop.test" });

  expect(mocks.transaction).not.toHaveBeenCalled();
});
