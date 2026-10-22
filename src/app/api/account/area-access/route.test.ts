import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn(), logError: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/modules/auth/application/get-account-area-access", () => ({ getAccountAreaAccess: mocks.access }));

import { GET } from "./route";

const user = { id: "user-a", email: "buyer@example.test", emailVerified: true };

describe("GET /api/account/area-access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("answers no area to someone signed out, without looking up access", async () => {
    mocks.session.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ admin: false, seller: false });
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("answers the signed-in user's areas and is never cached", async () => {
    mocks.session.mockResolvedValue({ user });
    mocks.access.mockResolvedValue({ admin: true, seller: false });

    const response = await GET();

    expect(mocks.access).toHaveBeenCalledWith(user);
    await expect(response.json()).resolves.toEqual({ admin: true, seller: false });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("logs a failure and answers no area with status 500", async () => {
    mocks.session.mockResolvedValue({ user });
    mocks.access.mockRejectedValue(new Error("database down"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ admin: false, seller: false });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ event: "account.area_access.failed" }));
  });
});
