import { ExternalLink } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getStatusLabel } from "@/shared/presentation/status-labels";

import type { CustomerShipment } from "./types";

const shipmentProgress = ["PENDING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "DELIVERED"] as const;

export function ShipmentTracking({ shipment }: { shipment: CustomerShipment | null }) {
  if (!shipment) {
    return (
      <div className="bg-surface-sunken text-muted-foreground rounded-lg p-3 text-sm">
        A loja ainda não preparou o envio deste pedido.
      </div>
    );
  }

  const currentIndex = shipmentProgress.indexOf(shipment.status as (typeof shipmentProgress)[number]);
  const hasProblem = shipment.status === "EXCEPTION" || shipment.status === "CANCELLED";

  return (
    <div className="bg-surface-sunken space-y-4 rounded-lg p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-foreground font-medium">
            {shipment.carrier} · {shipment.service}
          </p>
          {shipment.trackingCode ? (
            <p className="text-muted-foreground">
              Código de rastreio <span className="text-foreground font-mono">{shipment.trackingCode}</span>
            </p>
          ) : null}
          {shipment.deliveredAt ? (
            <p className="text-muted-foreground">Entregue em {formatDateTime(shipment.deliveredAt)}</p>
          ) : shipment.shippedAt ? (
            <p className="text-muted-foreground">Postado em {formatDateTime(shipment.shippedAt)}</p>
          ) : null}
        </div>
        <StatusBadge domain="shipment" status={shipment.status} />
      </div>

      <ol className="grid grid-cols-5 gap-1" aria-label="Progresso do envio">
        {shipmentProgress.map((step, index) => {
          const completed = !hasProblem && currentIndex >= index;
          const current = !hasProblem && currentIndex === index;
          return (
            <li
              key={step}
              className="flex flex-col items-center gap-1 text-center text-[11px] leading-tight"
              aria-current={current ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "border-border bg-background text-muted-foreground flex size-6 items-center justify-center rounded-full border text-xs",
                  completed && "border-primary bg-primary text-primary-foreground",
                  current && "ring-ring/40 ring-3",
                )}
              >
                {completed ? "✓" : index + 1}
              </span>
              <span className={completed ? "text-foreground" : "text-muted-foreground"}>
                {getStatusLabel("shipment", step)}
                <span className="sr-only">{completed ? " (concluído)" : " (pendente)"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {hasProblem ? (
        <p className="text-destructive text-xs" role="status">
          Status atual: {getStatusLabel("shipment", shipment.status)}. Se precisar, abra uma disputa abaixo.
        </p>
      ) : null}

      {shipment.trackingUrl ? (
        <a
          className="text-brand-strong inline-flex items-center gap-1 font-medium underline underline-offset-4"
          href={shipment.trackingUrl}
          target="_blank"
          rel="noreferrer"
        >
          Acompanhar entrega
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      ) : null}
    </div>
  );
}
