import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminAccess: vi.fn(),
  retry: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: mocks.requireAdminAccess }));
vi.mock("@/modules/notifications/application/retry-notification-delivery", () => ({
  retryNotificationDelivery: mocks.retry,
}));

import { resendNotificationDeliveryAction } from "./notification-delivery-actions";

const deliveryId = "cdelivery0000000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminAccess.mockResolvedValue({ user: { id: "admin-a" } });
  mocks.retry.mockResolvedValue({ ok: true });
});

it("requires admin access before touching deliveries", async () => {
  mocks.requireAdminAccess.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(resendNotificationDeliveryAction(deliveryId)).rejects.toThrow("FORBIDDEN");
  expect(mocks.retry).not.toHaveBeenCalled();
});

it("ignores malformed ids", async () => {
  await resendNotificationDeliveryAction("x");
  expect(mocks.retry).not.toHaveBeenCalled();
});

it("requests the resend as the authenticated admin", async () => {
  await resendNotificationDeliveryAction(deliveryId);
  expect(mocks.retry).toHaveBeenCalledWith({ deliveryId, actorUserId: "admin-a" });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin", "layout");
});

it("surfaces an enqueue failure", async () => {
  mocks.retry.mockResolvedValue({ ok: false, reason: "ENQUEUE_FAILED", error: "Não foi possível reenfileirar." });
  await expect(resendNotificationDeliveryAction(deliveryId)).rejects.toThrow("reenfileirar");
});
