import { Motorbike, CircleCheck, Info, TriangleAlert } from "lucide-react";

import type { ReactNode } from "react";

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

/** Where the page returns after a motorcycle is chosen, so the customer stays next to the price. */
export const FITMENT_ANCHOR = "sua-moto";

const linkClassName =
  "inline-flex min-h-10 items-center rounded-sm font-semibold underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

/**
 * Faixa compacta "Sua moto" exibida na área de compra. O seletor abre ali mesmo, perto do preço
 * e do botão de compra, em vez de levar o cliente para o fim da página.
 * Ausência de compatibilidade cadastrada significa "não confirmada", nunca incompatível.
 */
// "unknown" is neutral: gear such as helmets fits any bike, so a missing list is not a warning.
const fitmentTones = {
  fits: { box: "border-success/30 bg-success-surface text-success-foreground", Icon: CircleCheck },
  "does-not-fit": { box: "border-warning/40 bg-warning-surface text-warning-foreground", Icon: TriangleAlert },
  unknown: { box: "border-border bg-muted/50 text-foreground", Icon: Info },
};

/** Native <details>: keyboard and screen readers work without client state, and it starts closed. */
function PickerToggle({ label, className, picker }: { label: string; className: string; picker: ReactNode }) {
  return (
    <details className="group">
      <summary className={cn(linkClassName, "cursor-pointer list-none [&::-webkit-details-marker]:hidden", className)}>
        {label}
      </summary>
      <div className="mt-3">{picker}</div>
    </details>
  );
}

export function ProductFitmentBanner({ status, picker }: { status: FitmentStatus; picker: ReactNode }) {
  if (status.kind === "no-motorcycle") {
    return (
      <div id={FITMENT_ANCHOR} className="border-border bg-surface-sunken scroll-mt-24 rounded-xl border p-3 text-sm">
        <div className="flex items-start gap-3">
          <Motorbike aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
          <p className="text-muted-foreground">
            <span className="text-foreground font-semibold">Sua moto: </span>
            informe sua moto para saber se esta peça serve.
          </p>
        </div>
        <PickerToggle label="Escolher minha moto" className="text-brand-strong" picker={picker} />
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
    <div id={FITMENT_ANCHOR} className={cn("scroll-mt-24 rounded-xl border p-3 text-sm", tone.box)}>
      <div className="flex items-start gap-3" role="status">
        <tone.Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{message}</p>
          <p className="mt-0.5">
            Sua moto: {status.motorcycleLabel}
            {fitmentHint[status.kind]}
          </p>
        </div>
      </div>
      {/* Keyed by the motorcycle: after a choice the page re-renders with it and the picker closes. */}
      <PickerToggle key={status.motorcycleLabel} label="Trocar moto" className="min-h-8 text-xs" picker={picker} />
    </div>
  );
}
