"use client";

import { Bike } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import { FormMessage } from "@/components/ui/form-message";

import { savePrimaryMotorcycleFromProductAction } from "../actions/saved-motorcycle-actions";
import { formatFitmentVariantLabel, type FitmentOption } from "../domain/fitment-options";
import { callServerAction } from "@/shared/forms/server-action-submit";

function unique(values: string[]) {
  return [...new Set(values)];
}

/** URL do produto com `?moto=` atualizado (ou removido), preservando os demais parâmetros. */
export function withMotoParam(productHref: string, fitmentId: string | null) {
  const [path, search = ""] = productHref.split("?");
  const query = new URLSearchParams(search);
  if (fitmentId) query.set("moto", fitmentId);
  if (!fitmentId) query.delete("moto");
  const serialized = query.toString();
  return `${path}${serialized ? `?${serialized}` : ""}`;
}

/**
 * Seletor "Sua moto" da página do produto (fabricante → modelo → ano/versão).
 * Com sessão, salva a moto como principal na conta; sem sessão, a escolha fica
 * apenas na URL (`?moto=`) e o cliente recebe a dica para entrar e salvar.
 */
export function ProductMotorcyclePicker({
  fitments,
  selectedFitmentId,
  savedFitmentId,
  signedIn,
  productHref,
}: {
  fitments: FitmentOption[];
  /** Moto efetiva da página (URL ou principal salva). */
  selectedFitmentId: string | null;
  /** Moto principal salva na conta, quando houver. */
  savedFitmentId: string | null;
  signedIn: boolean;
  /** Caminho atual do produto sem hash (pode conter `?moto=` e parâmetros de avaliações). */
  productHref: string;
}) {
  const router = useRouter();
  const initial = fitments.find((fitment) => fitment.id === selectedFitmentId);
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [fitmentId, setFitmentId] = useState(initial?.id ?? "");
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  const manufacturers = unique(fitments.map((fitment) => fitment.manufacturer));
  const models = unique(
    fitments.filter((fitment) => fitment.manufacturer === manufacturer).map((fitment) => fitment.model),
  );
  const variants = fitments.filter((fitment) => fitment.manufacturer === manufacturer && fitment.model === model);
  const alreadySaved = signedIn && fitmentId !== "" && fitmentId === savedFitmentId;

  if (fitments.length === 0) {
    return <p className="text-muted-foreground text-sm">A seleção de motos está indisponível no momento.</p>;
  }

  function submit() {
    if (!fitmentId) {
      setMessage({ error: "Escolha fabricante, modelo e ano da sua moto." });
      return;
    }
    setMessage({});
    if (!signedIn) {
      router.replace(`${withMotoParam(productHref, fitmentId)}#compatibilidade` as Route, { scroll: false });
      return;
    }
    startTransition(async () => {
      const [productPath = productHref] = productHref.split("?");
      const result = await callServerAction(() => savePrimaryMotorcycleFromProductAction(fitmentId, productPath));
      setMessage(result);
      if (!result.error) {
        // A moto salva passa a ser a referência; remove a escolha temporária da URL.
        router.replace(`${withMotoParam(productHref, null)}#compatibilidade` as Route, { scroll: false });
        router.refresh();
      }
    });
  }

  const loginHref = `/login?next=${encodeURIComponent(withMotoParam(productHref, fitmentId || null))}`;

  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
        Fabricante
        <DesignSelect
          aria-label="Fabricante da sua moto"
          className="h-11"
          value={manufacturer}
          onValueChange={(value) => {
            const next = String(value ?? "");
            setManufacturer(next);
            const nextModels = unique(
              fitments.filter((fitment) => fitment.manufacturer === next).map((fitment) => fitment.model),
            );
            setModel(nextModels.length === 1 ? (nextModels[0] ?? "") : "");
            setFitmentId("");
          }}
        >
          <option value="">Selecione</option>
          {manufacturers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
        Modelo
        <DesignSelect
          aria-label="Modelo da sua moto"
          className="h-11"
          disabled={!manufacturer}
          value={model}
          onValueChange={(value) => {
            const next = String(value ?? "");
            setModel(next);
            const nextVariants = fitments.filter(
              (fitment) => fitment.manufacturer === manufacturer && fitment.model === next,
            );
            setFitmentId(nextVariants.length === 1 ? (nextVariants[0]?.id ?? "") : "");
          }}
        >
          <option value="">Selecione</option>
          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
        Ano e versão
        <DesignSelect
          aria-label="Ano e versão da sua moto"
          className="h-11"
          disabled={!model}
          value={fitmentId}
          onValueChange={(value) => setFitmentId(String(value ?? ""))}
        >
          <option value="">Selecione</option>
          {variants.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {formatFitmentVariantLabel(fitment)}
            </option>
          ))}
        </DesignSelect>
      </label>
      <div className="flex flex-col gap-2 sm:col-span-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button type="submit" size="lg" disabled={pending || !fitmentId || alreadySaved} className="px-5">
          <Bike aria-hidden="true" />
          {pending
            ? "Salvando..."
            : alreadySaved
              ? "Moto salva na sua conta"
              : signedIn
                ? "Salvar como minha moto"
                : "Ver se serve na minha moto"}
        </Button>
        {!signedIn ? (
          <p className="text-muted-foreground text-sm">
            <Link href={loginHref as Route} className={buttonVariants({ variant: "link", size: "link" })}>
              Entre para salvar sua moto
            </Link>{" "}
            e ver a compatibilidade em todas as peças.
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-3" aria-live="polite">
        <FormMessage error={message.error ?? null} success={message.success ?? null} />
      </div>
    </form>
  );
}
