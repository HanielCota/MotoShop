export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
export type DisputeDecision = "START_REVIEW" | "RESOLVE" | "REJECT";

export function getNextDisputeStatus(status: DisputeStatus, decision: DisputeDecision): DisputeStatus {
  if (decision === "START_REVIEW" && status === "OPEN") return "UNDER_REVIEW";
  if (decision === "RESOLVE" && status === "UNDER_REVIEW") return "RESOLVED";
  if (decision === "REJECT" && ["OPEN", "UNDER_REVIEW"].includes(status)) return "REJECTED";
  throw new Error(`Invalid dispute transition: ${status} -> ${decision}`);
}
