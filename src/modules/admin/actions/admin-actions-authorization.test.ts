import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminAccess: vi.fn(),
  reviewDispute: vi.fn(),
  reviewCancellationRequest: vi.fn(),
  reviewReturnRequest: vi.fn(),
  refundReturnRequest: vi.fn(),
  activateVipSubscription: vi.fn(),
  moderateContent: vi.fn(),
  reconcileShipmentPurchase: vi.fn(),
  reconcileShipmentGeneration: vi.fn(),
  confirmShipmentLabelCancelled: vi.fn(),
  sellerFindFirst: vi.fn(),
  sellerUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: mocks.requireAdminAccess }));
vi.mock("@/lib/database", () => ({
  db: {
    seller: { findFirst: mocks.sellerFindFirst, update: mocks.sellerUpdate },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/modules/disputes/application/review-dispute", () => ({ reviewDispute: mocks.reviewDispute }));
vi.mock("@/modules/returns/application/review-cancellation", () => ({
  reviewCancellationRequest: mocks.reviewCancellationRequest,
}));
vi.mock("@/modules/returns/application/review-return", () => ({ reviewReturnRequest: mocks.reviewReturnRequest }));
vi.mock("@/modules/returns/application/refund-return", () => ({ refundReturnRequest: mocks.refundReturnRequest }));
vi.mock("@/modules/subscriptions/application/activate-vip-subscription", () => ({
  activateVipSubscription: mocks.activateVipSubscription,
}));
vi.mock("@/modules/moderation/application/moderate-content", () => ({ moderateContent: mocks.moderateContent }));
vi.mock("@/modules/shipping/application/reconcile-shipment-purchase", () => ({
  reconcileShipmentPurchase: mocks.reconcileShipmentPurchase,
}));
vi.mock("@/modules/shipping/application/reconcile-shipment-generation", () => ({
  reconcileShipmentGeneration: mocks.reconcileShipmentGeneration,
}));
vi.mock("@/modules/shipping/application/shipment-label-cancellation", () => ({
  confirmShipmentLabelCancelled: mocks.confirmShipmentLabelCancelled,
}));

import { reviewDisputeAction } from "@/modules/disputes/actions/admin-dispute-actions";
import { moderateContentAction } from "@/modules/moderation/actions/moderate-content-action";
import { reviewCancellationRequestAction } from "@/modules/returns/actions/admin-cancellation-actions";
import { refundReturnRequestAction, reviewReturnRequestAction } from "@/modules/returns/actions/admin-return-actions";
import {
  approveSellerAction,
  reactivateSellerAction,
  rejectSellerAction,
  suspendSellerAction,
} from "@/modules/sellers/actions/admin-seller-actions";
import { activateVipSubscriptionAction } from "@/modules/subscriptions/actions/admin-subscription-actions";
import { confirmShipmentLabelCancelledAction, reconcileShipmentPurchaseAction } from "./shipment-recovery-actions";

const recordId = "cmf8w8m4p0000s6o5zj2q8v3k";

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const adminActions: Array<[string, () => Promise<unknown>]> = [
  ["reviewDisputeAction", () => reviewDisputeAction(recordId, formData({ decision: "RESOLVE" }))],
  [
    "reviewCancellationRequestAction",
    () => reviewCancellationRequestAction(recordId, formData({ decision: "APPROVE" })),
  ],
  ["reviewReturnRequestAction", () => reviewReturnRequestAction(recordId, formData({ decision: "APPROVE" }))],
  ["refundReturnRequestAction", () => refundReturnRequestAction(recordId)],
  ["approveSellerAction", () => approveSellerAction(recordId)],
  ["rejectSellerAction", () => rejectSellerAction(recordId, { reason: "Motivo de teste" })],
  ["suspendSellerAction", () => suspendSellerAction(recordId)],
  ["reactivateSellerAction", () => reactivateSellerAction(recordId)],
  [
    "activateVipSubscriptionAction",
    () => activateVipSubscriptionAction({}, formData({ sellerId: recordId, months: "1" })),
  ],
  [
    "moderateContentAction",
    () => moderateContentAction({}, formData({ kind: "question", id: recordId, hide: "true" })),
  ],
  [
    "reconcileShipmentPurchaseAction",
    () =>
      reconcileShipmentPurchaseAction(
        {},
        formData({
          shipmentId: recordId,
          operation: "PURCHASE",
          decision: "CONFIRMED_NOT_PURCHASED",
          confirmedOrderNumber: "MS-202610-00001",
        }),
      ),
  ],
  [
    "confirmShipmentLabelCancelledAction",
    () =>
      confirmShipmentLabelCancelledAction(
        {},
        formData({ shipmentId: recordId, confirmedOrderNumber: "MS-202610-00001" }),
      ),
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminAccess.mockRejectedValue(new Error("FORBIDDEN"));
});

it.each(adminActions)("%s requires admin access before any service or database call", async (_name, execute) => {
  await expect(execute()).rejects.toThrow("FORBIDDEN");

  expect(mocks.requireAdminAccess).toHaveBeenCalledOnce();
  const sideEffects = [
    mocks.reviewDispute,
    mocks.reviewCancellationRequest,
    mocks.reviewReturnRequest,
    mocks.refundReturnRequest,
    mocks.activateVipSubscription,
    mocks.moderateContent,
    mocks.reconcileShipmentPurchase,
    mocks.reconcileShipmentGeneration,
    mocks.confirmShipmentLabelCancelled,
    mocks.sellerFindFirst,
    mocks.sellerUpdate,
    mocks.auditCreate,
    mocks.transaction,
    mocks.revalidatePath,
  ];
  for (const sideEffect of sideEffects) expect(sideEffect).not.toHaveBeenCalled();
});
