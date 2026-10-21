import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ memberships: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/modules/auth/application/authorization", () => ({
  requireAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-a" } })),
  requireSellerAccess: vi.fn(),
}));
vi.mock("@/modules/sellers/queries/sellers", () => ({ getUserSellerMemberships: mocks.memberships }));
import { getSellerDashboardContext } from "./get-seller-dashboard-context";

function membership(sellerId: string, status: string) {
  return { role: "OWNER", seller: { id: sellerId, status, store: { id: `store-${sellerId}` } } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("seller dashboard context", () => {
  it("opens the store where the member is active even when an older membership is still pending", async () => {
    mocks.memberships.mockResolvedValue([
      membership("seller-pending", "PENDING"),
      membership("seller-active", "ACTIVE"),
    ]);

    const context = await getSellerDashboardContext();

    expect(context).toMatchObject({ status: "ready", seller: { id: "seller-active" } });
  });

  it("shows the application status when no membership is approved yet", async () => {
    mocks.memberships.mockResolvedValue([membership("seller-pending", "PENDING")]);

    await expect(getSellerDashboardContext()).resolves.toMatchObject({ status: "pending" });
  });
});
