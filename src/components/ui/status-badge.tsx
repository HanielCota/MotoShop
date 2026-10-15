import { Check, Circle, CircleX, Clock, TriangleAlert, Truck } from "lucide-react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import {
  getStatusPresentation,
  type StatusDomain,
  type StatusMeaning,
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

// O ícone segue o significado do status, não a cor, para que o status não dependa só de cor
// (WCAG 1.4.1) e o mesmo símbolo signifique sempre a mesma coisa (IC-01). `X` fica para fechar/limpar.
const meaningIcon = {
  waiting: Clock,
  done: Check,
  transit: Truck,
  attention: TriangleAlert,
  failed: CircleX,
  idle: Circle,
} as const satisfies Record<StatusMeaning, unknown>;

type StatusBadgeProps = Omit<ComponentProps<typeof Badge>, "variant" | "children"> & {
  domain: StatusDomain;
  status: string;
  /** Sobrescreve o rótulo padrão quando o contexto pede um texto específico. */
  label?: string;
};

export function StatusBadge({ domain, status, label, ...props }: StatusBadgeProps) {
  const presentation = getStatusPresentation(domain, status);
  const Icon = meaningIcon[presentation.meaning];

  return (
    <Badge variant={toneVariant[presentation.tone]} data-status={status} {...props}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {label ?? presentation.label}
    </Badge>
  );
}
