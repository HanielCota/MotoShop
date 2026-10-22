import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  requestReturn: vi.fn(),
  requestCancellation: vi.fn(),
  requestDispute: vi.fn(),
  guestCookie: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/auth/application/authorization", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/modules/orders/application/resolve-customer-order-access", () => ({
  resolveCustomerOrderIdentity: mocks.resolve,
}));
vi.mock("@/modules/orders/infrastructure/guest-order-cookie", () => ({ readGuestOrderCookie: mocks.guestCookie }));
vi.mock("../application/request-return", () => ({ requestReturn: mocks.requestReturn }));
vi.mock("../application/return-photo-uploads", () => ({
  createReturnPhotoUpload: vi.fn(),
  removeReturnPhotoUpload: vi.fn(),
}));
vi.mock("@/shared/rate-limit/consume-rate-limit", () => ({ assertRateLimit: vi.fn() }));
vi.mock("../application/request-cancellation", () => ({ requestCancellation: mocks.requestCancellation }));
vi.mock("@/modules/disputes/application/request-dispute", () => ({ requestDispute: mocks.requestDispute }));

import { requestDisputeAction } from "@/modules/disputes/actions/dispute-actions";

import { requestCancellationAction } from "./cancellation-actions";
import { requestReturnAction } from "./return-actions";

const cuid = "cjld2cjxh0000qzrmn831i7rn";
const uuid = "6f1c2c1e-6c1a-4e0b-9b3f-2f8f5f7f8a11";
const guestIdentity = { guestAccessTokenHash: "hash" };

const cases = [
  {
    name: "return",
    run: (extra: Record<string, unknown>) =>
      requestReturnAction({
        orderNumber: "MS-1",
        orderItemId: cuid,
        quantity: 1,
        reason: "DAMAGED",
        idempotencyKey: uuid,
        ...extra,
      }),
    service: mocks.requestReturn,
  },
  {
    name: "cancellation",
    run: (extra: Record<string, unknown>) =>
      requestCancellationAction({
        orderNumber: "MS-1",
        sellerOrderId: cuid,
        reason: "Desisti",
        idempotencyKey: uuid,
        ...extra,
      }),
    service: mocks.requestCancellation,
  },
  {
    name: "dispute",
    run: (extra: Record<string, unknown>) =>
      requestDisputeAction({
        orderNumber: "MS-1",
        sellerOrderId: cuid,
        reason: "Produto",
        description: "Produto chegou diferente do anunciado.",
        idempotencyKey: uuid,
        ...extra,
      }),
    service: mocks.requestDispute,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requestReturn.mockResolvedValue({ id: "r" });
});

describe.each(cases)("$name action order access", ({ run, service }) => {
  it("lets a logged-in user act on a guest order opened through its secure link", async () => {
    mocks.session.mockResolvedValue({ user: { id: "user-1" } });
    mocks.guestCookie.mockResolvedValue("secure-token");
    mocks.resolve.mockResolvedValue(guestIdentity);
    const result = await run({});
    expect(result).toHaveProperty("success");
    expect(mocks.resolve).toHaveBeenCalledWith({ orderNumber: "MS-1", accessToken: "secure-token", userId: "user-1" });
    expect(service).toHaveBeenCalledWith(expect.objectContaining({ identity: guestIdentity }));
  });

  it("requires a session or the order cookie, ignoring a token sent in the request", async () => {
    mocks.session.mockResolvedValue(null);
    mocks.guestCookie.mockResolvedValue(undefined);
    expect(await run({ accessToken: "secure-token" })).toHaveProperty("error");
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
  });

  it("does not call the service when no credential owns the order", async () => {
    mocks.session.mockResolvedValue({ user: { id: "intruder" } });
    mocks.guestCookie.mockResolvedValue("wrong");
    mocks.resolve.mockResolvedValue(null);
    expect(await run({})).toEqual({ error: "Pedido não encontrado." });
    expect(service).not.toHaveBeenCalled();
  });
});
