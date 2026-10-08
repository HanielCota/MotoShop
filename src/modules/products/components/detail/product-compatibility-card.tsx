import Link from "next/link";
import type { Route } from "next";

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

export function ProductCompatibilityCard({
  compatibilities,
  primaryFitmentId,
}: {
  compatibilities: { id: string; motorcycleFitmentId: string; motorcycleFitment: FitmentSummary }[];
  primaryFitmentId: string | null;
}) {
  return (
    <Card id="compatibilidade" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl">Compatibilidade com motos</h2>
        </CardTitle>
        <CardDescription>Confira a configuração antes de escolher uma peça.</CardDescription>
      </CardHeader>
      <CardContent>
        {compatibilities.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            A loja ainda não informou compatibilidade deste produto com motos específicas.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {compatibilities.map((compatibility) => {
              const isPrimary = compatibility.motorcycleFitmentId === primaryFitmentId;
              return (
                <li key={compatibility.id}>
                  <Link
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-3 py-1 transition-colors",
                      "focus-visible:ring-ring/40 focus-visible:ring-3 focus-visible:outline-none",
                      isPrimary
                        ? "border-success/30 bg-success-surface text-success-foreground font-semibold"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    href={`/products?moto=${encodeURIComponent(compatibility.motorcycleFitmentId)}` as Route}
                  >
                    {formatFitmentLabel(compatibility.motorcycleFitment, { includeDisplacement: true })}
                    {isPrimary ? <span className="sr-only"> (sua moto)</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
