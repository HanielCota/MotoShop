import Link from "next/link";
import type { Route } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { SellerCatalogProgress as Progress } from "../queries/seller-catalog-progress";

export function SellerCatalogProgress({ progress }: { progress: Progress }) {
  // Com um produto publicado, os quatro passos estão concluídos: o checklist sai da visão geral.
  if (progress.approved > 0) return null;

  const hasProduct = progress.editable + progress.submitted > 0;
  const hasSubmitted = progress.submitted > 0;
  const steps = [
    { label: "Loja aprovada", complete: true },
    { label: "Primeiro produto cadastrado", complete: hasProduct },
    { label: "Produto enviado para revisão", complete: hasSubmitted },
    { label: "Primeiro produto publicado", complete: false },
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
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.complete ? "bg-success-surface text-success-foreground" : "bg-muted text-muted-foreground"}`}
                aria-hidden="true"
              >
                {step.complete ? "✓" : index + 1}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
        {progress.submitted > 0 ? (
          <p className="text-muted-foreground text-sm">
            {progress.submitted} {progress.submitted === 1 ? "produto" : "produtos"} aguardando análise pelo Moto Shop.
            Acompanhe o status em{" "}
            <Link
              href={"/seller/products" as Route}
              className="text-brand-strong font-medium underline underline-offset-4"
            >
              Produtos
            </Link>
            .
          </p>
        ) : progress.editable > 0 ? (
          <p className="text-muted-foreground text-sm">
            Revise os rascunhos ou produtos rejeitados em{" "}
            <Link
              href={"/seller/products" as Route}
              className="text-brand-strong font-medium underline underline-offset-4"
            >
              Produtos
            </Link>{" "}
            e envie um produto para aprovação.
          </p>
        ) : (
          <Link
            href="/seller/products/new"
            className="text-brand-text text-sm font-medium underline underline-offset-4"
          >
            Cadastrar meu primeiro produto
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
