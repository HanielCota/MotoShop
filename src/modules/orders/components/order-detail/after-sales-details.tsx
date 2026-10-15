import { InlineNotice } from "@/components/ui/inline-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import { disputeReasonLabels, getStatusLabel, returnReasonLabels } from "@/shared/presentation/status-labels";

// The team's notes (resolutionNote/adminNote) stay internal: the customer sees only what they sent.
type DisputeSummary = { status: string; reason: string; description: string; createdAt: Date };
type ReturnSummary = { status: string; reason: string; customerMessage: string | null; createdAt: Date };

const OPEN_DISPUTE_STATUSES = new Set(["OPEN", "UNDER_REVIEW"]);
const OPEN_RETURN_STATUSES = new Set(["REQUESTED", "UNDER_REVIEW", "APPROVED", "WAITING_RETURN", "RETURNED"]);

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="inline font-medium">{label}:</dt> <dd className="inline">{children}</dd>
    </div>
  );
}

/** What the customer reported in a dispute and what happens next. */
export function DisputeDetails({ dispute }: { dispute: DisputeSummary }) {
  return (
    <InlineNotice tone="warning" role="status">
      <p className="inline-flex flex-wrap items-center gap-2 font-semibold">
        Disputa com mediação do Moto Shop
        <StatusBadge domain="dispute" status={dispute.status} />
      </p>
      <dl className="mt-2 grid gap-1 text-sm">
        <Detail label="Aberta em">{formatDate(dispute.createdAt)}</Detail>
        <Detail label="Motivo">{disputeReasonLabels[dispute.reason] ?? dispute.reason}</Detail>
        <Detail label="O que você relatou">{dispute.description}</Detail>
      </dl>
      {OPEN_DISPUTE_STATUSES.has(dispute.status) ? (
        <p className="mt-2 text-sm">
          <strong>O que acontece agora:</strong> a equipe do Moto Shop analisa o caso com a loja e avisa por e-mail. A
          decisão também aparece aqui.
        </p>
      ) : null}
    </InlineNotice>
  );
}

/** Return request of one item: when it was asked, why, and the customer's own message. */
export function ReturnDetails({ request }: { request: ReturnSummary }) {
  return (
    <InlineNotice tone="info" role="status">
      <p className="font-semibold">Devolução: {getStatusLabel("return", request.status)}</p>
      <dl className="mt-2 grid gap-1 text-sm">
        <Detail label="Solicitada em">{formatDate(request.createdAt)}</Detail>
        <Detail label="Motivo">{returnReasonLabels[request.reason] ?? request.reason}</Detail>
        {request.customerMessage ? <Detail label="O que você relatou">{request.customerMessage}</Detail> : null}
      </dl>
      {OPEN_RETURN_STATUSES.has(request.status) ? (
        <p className="mt-2 text-sm">
          <strong>O que acontece agora:</strong> a loja e o Moto Shop acompanham a devolução e avisam por e-mail a cada
          etapa.
        </p>
      ) : null}
    </InlineNotice>
  );
}
