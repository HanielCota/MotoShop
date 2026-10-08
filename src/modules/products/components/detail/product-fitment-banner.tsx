import { Bike, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/lib/utils";

export type FitmentStatus =
  | { kind: "fits"; motorcycleLabel: string }
  | { kind: "does-not-fit"; motorcycleLabel: string }
  | { kind: "unknown"; motorcycleLabel: string }
  | { kind: "no-motorcycle"; signedIn: boolean; productPath: string };

/** Faixa compacta "Minha Moto" exibida antes da escolha de variante. */
export function ProductFitmentBanner({ status }: { status: FitmentStatus }) {
  const linkClassName =
    "inline-flex min-h-10 items-center font-semibold underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none rounded-sm";

  if (status.kind === "no-motorcycle") {
    const href = status.signedIn
      ? "/account/motorcycles"
      : `/login?next=${encodeURIComponent("/account/motorcycles")}`;
    return (
      <div className="border-border bg-surface-sunken flex items-start gap-3 rounded-xl border p-3 text-sm">
        <Bike aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <p className="text-muted-foreground">
          <span className="text-foreground font-semibold">Minha Moto: </span>
          selecione sua moto para saber se esta peça serve.{" "}
          <Link href={href as Route} className={cn(linkClassName, "text-brand-strong")}>
            Selecionar moto
          </Link>
        </p>
      </div>
    );
  }

  const tone =
    status.kind === "fits"
      ? { box: "border-success/30 bg-success-surface text-success-foreground", Icon: CircleCheck }
      : { box: "border-warning/40 bg-warning-surface text-warning-foreground", Icon: TriangleAlert };
  const message =
    status.kind === "fits"
      ? "Compatível com sua moto"
      : status.kind === "does-not-fit"
        ? "Compatibilidade com sua moto não confirmada"
        : "A loja não informou compatibilidade";

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", tone.box)} role="status">
      <tone.Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{message}</p>
        <p className="mt-0.5">
          {status.motorcycleLabel}
          {status.kind === "fits" ? " · confira também a versão do seu modelo." : " · veja a lista de motos compatíveis."}
        </p>
        <Link href="/account/motorcycles" className={cn(linkClassName, "min-h-8 text-xs")}>
          Trocar moto
        </Link>
      </div>
    </div>
  );
}
