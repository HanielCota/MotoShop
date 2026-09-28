import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/config/env", () => ({ env: { ADMIN_EMAILS: "admin@example.test" } }));
vi.mock("@/lib/database", () => ({ db: {} }));
vi.mock("@/modules/auth/infrastructure/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
import { requireAdminAccess } from "./authorization";

beforeEach(() => vi.clearAllMocks());
describe("administrator authorization", () => {
  it("denies unverified allowlisted email", async () => {
    mocks.session.mockResolvedValue({ user: { email: "admin@example.test", emailVerified: false } });
    await expect(requireAdminAccess()).rejects.toThrow("redirect:/forbidden");
  });
  it("denies verified users outside the allowlist", async () => {
    mocks.session.mockResolvedValue({ user: { email: "other@example.test", emailVerified: true } });
    await expect(requireAdminAccess()).rejects.toThrow("redirect:/forbidden");
  });
  it("accepts verified allowlisted users", async () => {
    const session = { user: { email: "ADMIN@example.test", emailVerified: true } };
    mocks.session.mockResolvedValue(session);
    await expect(requireAdminAccess()).resolves.toEqual(session);
  });
});
