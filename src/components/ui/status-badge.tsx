import { AlertTriangle, Check, Circle, Clock, Truck, X } from "lucide-react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import {
  getStatusPresentation,
  type StatusDomain,
  type StatusTone,
} from "@/shared/presentation/status-labels";

const toneVariant = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "destructive",
  brand: "brand",
} as const satisfies Record<StatusTone, ComponentProps<typeof Badge>["variant"]>;

// Ícone acompanha a cor para que o status não dependa só de cor (WCAG 1.4.1).
const toneIcon = {
  neutral: Circle,
  info: Clock,
  success: Check,
  warning: AlertTriangle,
  danger: X,
  brand: Truck,
} as const;

type StatusBadgeProps = Omit<ComponentProps<typeof Badge>, "variant" | "children"> & {
  domain: StatusDomain;
  status: string;
  /** Sobrescreve o rótulo padrão quando o contexto pede um texto específico. */
  label?: string;
};

export function StatusBadge({ domain, status, label, ...props }: StatusBadgeProps) {
  const presentation = getStatusPresentation(domain, status);
  const Icon = toneIcon[presentation.tone];

  return (
    <Badge variant={toneVariant[presentation.tone]} data-status={status} {...props}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {label ?? presentation.label}
    </Badge>
  );
}
