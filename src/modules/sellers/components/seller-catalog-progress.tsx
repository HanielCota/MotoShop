import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { SellerCatalogProgress as Progress } from "../queries/seller-catalog-progress";

export function SellerCatalogProgress({ progress }: { progress: Progress }) {
  const hasProduct = progress.editable + progress.submitted + progress.approved > 0;
  const hasSubmitted = progress.submitted + progress.approved > 0;
  const steps = [
    { label: "Loja aprovada", complete: true },
    { label: "Primeiro produto cadastrado", complete: hasProduct },
    { label: "Produto enviado para revisão", complete: hasSubmitted },
    { label: "Primeiro produto publicado", complete: progress.approved > 0 },
  ];

  return (
    <Card aria-label="Progresso da loja">
      <CardHeader>
        <CardTitle>Primeiros passos da sua loja</CardTitle>
        <CardDescription>Veja o que falta para o primeiro produto aparecer no catálogo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.complete ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
                aria-hidden="true"
              >
                {step.complete ? "✓" : index + 1}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
        {progress.approved > 0 ? (
          <p className="text-muted-foreground text-sm">Sua loja já tem {progress.approved} produto(s) publicado(s).</p>
        ) : progress.submitted > 0 ? (
          <p className="text-muted-foreground text-sm">
            {progress.submitted} produto(s) aguardando análise da Moto Shop. Você pode acompanhar o status abaixo.
          </p>
        ) : progress.editable > 0 ? (
          <p className="text-muted-foreground text-sm">
            Revise os rascunhos ou produtos rejeitados abaixo e envie um produto para aprovação.
          </p>
        ) : (
          <Link href="/seller/products/new" className="text-primary text-sm font-medium underline underline-offset-4">
            Cadastrar meu primeiro produto
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
