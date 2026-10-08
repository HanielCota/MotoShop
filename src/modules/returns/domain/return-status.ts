import { ApplicationError } from "@/shared/errors/application-error";

export type ReturnStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "WAITING_RETURN"
  | "RETURNED"
  | "REFUNDED"
  | "REJECTED";

export type ReturnReviewDecision = "APPROVE" | "REJECT" | "RECEIVE";

/** Transições administrativas da devolução. O reembolso (RETURNED → REFUNDED) é tratado em `refund-return`. */
export function getNextReturnStatus(
  currentStatus: ReturnStatus,
  decision: ReturnReviewDecision,
): "APPROVED" | "REJECTED" | "RETURNED" {
  if (decision === "APPROVE" && (currentStatus === "REQUESTED" || currentStatus === "UNDER_REVIEW")) return "APPROVED";
  if (decision === "REJECT" && (currentStatus === "REQUESTED" || currentStatus === "UNDER_REVIEW")) return "REJECTED";
  if (decision === "RECEIVE" && currentStatus === "APPROVED") return "RETURNED";
  throw new ApplicationError({
    code: "CONFLICT",
    message: "Esta transição de devolução não é permitida.",
    statusCode: 409,
  });
}
