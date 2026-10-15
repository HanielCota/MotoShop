import { Motorbike, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type FitmentStatus =
  | { kind: "fits"; motorcycleLabel: string }
  | { kind: "does-not-fit"; motorcycleLabel: string }
  | { kind: "unknown"; motorcycleLabel: string }
  | { kind: "no-motorcycle" };

// Without any compatibility informed there is no list to check, so the customer is sent to the store.
const fitmentHint = {
  fits: " · confira também a versão do seu modelo.",
  "does-not-fit": " · veja a lista de motos compatíveis.",
  unknown: ". Antes de comprar, pergunte à loja se esta peça serve.",
} as const;

const linkClassName =
  "inline-flex min-h-10 items-center rounded-sm font-semibold underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

/**
 * Faixa compacta "Sua moto" exibida na área de compra. A escolha da moto acontece na
 * seção de compatibilidade da própria página (#compatibilidade), sem sair do produto.
 * Ausência de compatibilidade cadastrada significa "não confirmada", nunca incompatível.
 */
// "unknown" is neutral: gear such as helmets fits any bike, so a missing list is not a warning.
const fitmentTones = {
  fits: { box: "border-success/30 bg-success-surface text-success-foreground", Icon: CircleCheck },
  "does-not-fit": { box: "border-warning/40 bg-warning-surface text-warning-foreground", Icon: TriangleAlert },
  unknown: { box: "border-border bg-muted/50 text-foreground", Icon: Info },
};

export function ProductFitmentBanner({ status }: { status: FitmentStatus }) {
  if (status.kind === "no-motorcycle") {
    return (
      <div className="border-border bg-surface-sunken flex items-start gap-3 rounded-xl border p-3 text-sm">
        <Motorbike aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <p className="text-muted-foreground">
          <span className="text-foreground font-semibold">Sua moto: </span>
          informe sua moto para saber se esta peça serve.{" "}
          <a href="#compatibilidade" className={cn(linkClassName, "text-brand-strong")}>
            Escolher minha moto
          </a>
        </p>
      </div>
    );
  }

  const tone = fitmentTones[status.kind];
  const message =
    status.kind === "fits"
      ? "Serve na sua moto"
      : status.kind === "does-not-fit"
        ? "Compatibilidade com sua moto não confirmada"
        : "A loja não informou compatibilidade";

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", tone.box)} role="status">
      <tone.Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{message}</p>
        <p className="mt-0.5">
          Sua moto: {status.motorcycleLabel}
          {fitmentHint[status.kind]}
        </p>
        <a href="#compatibilidade" className={cn(linkClassName, "min-h-8 text-xs")}>
          Trocar moto
        </a>
      </div>
    </div>
  );
}
