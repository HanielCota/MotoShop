import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FitmentSummary = {
  year: number;
  version: string | null;
  displacementCc: number;
  motorcycleModel: { name: string; manufacturer: { name: string } };
};

export function formatFitmentLabel(fitment: FitmentSummary, options: { includeDisplacement?: boolean } = {}) {
  const parts = [
    `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name}`,
    fitment.version || "padrão",
    ...(options.includeDisplacement ? [`${fitment.displacementCc} cc`] : []),
    String(fitment.year),
  ];
  return parts.join(" · ");
}

/**
 * "Peças para a sua moto": status de compatibilidade, seletor da moto do cliente
 * (salvo na conta quando autenticado) e lista estruturada de motos compatíveis.
 */
export function ProductCompatibilityCard({
  compatibilities,
  selectedFitmentId,
  status,
  picker,
}: {
  compatibilities: { id: string; motorcycleFitmentId: string; motorcycleFitment: FitmentSummary }[];
  selectedFitmentId: string | null;
  status: ReactNode;
  picker: ReactNode;
}) {
  return (
    <Card id="compatibilidade" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Peças para a sua moto</CardTitle>
        <CardDescription>
          {selectedFitmentId
            ? "Confira abaixo se esta peça serve na moto escolhida."
            : "Informe sua moto para conferir se esta peça é compatível."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0 space-y-4">
          {status}
          {picker}
        </div>
        <div className="min-w-0">
          <h3 className="text-foreground font-sans text-sm font-semibold tracking-normal">
            Motos compatíveis informadas pela loja
          </h3>
          {compatibilities.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              A loja ainda não informou compatibilidade deste produto com motos específicas.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {compatibilities.map((compatibility) => {
                const isSelected = compatibility.motorcycleFitmentId === selectedFitmentId;
                return (
                  <li key={compatibility.id}>
                    <Link
                      className={cn(
                        "inline-flex min-h-10 items-center rounded-full border px-3 py-1 transition-colors",
                        "focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none",
                        isSelected
                          ? "border-success/30 bg-success-surface text-success-foreground font-semibold"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      href={`/products?moto=${encodeURIComponent(compatibility.motorcycleFitmentId)}` as Route}
                    >
                      {formatFitmentLabel(compatibility.motorcycleFitment, { includeDisplacement: true })}
                      {isSelected ? <span className="sr-only"> (sua moto)</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
