"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DesignCheckbox } from "@/components/ui/design-checkbox";

import { DesignSelect } from "@/components/ui/design-select";

import Link from "next/link";
import { Motorbike, Plus, Star } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { useState } from "react";

import {
  addSavedMotorcycleAction,
  changeSavedMotorcycleAction,
  removeSavedMotorcycleAction,
  setPrimarySavedMotorcycleAction,
  type SavedMotorcycleActionState,
} from "../actions/saved-motorcycle-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type FitmentOption = { id: string; label: string };
type SavedMotorcycle = {
  id: string;
  motorcycleFitmentId: string;
  label: string;
  manufacturer: string;
  model: string;
  /** Empty when the fitment has no named version. */
  version: string;
  year: number;
  isPrimary: boolean;
  available: boolean;
  compatibleProductCount: number;
};

const initialState: SavedMotorcycleActionState = {};
const inputClassName = "h-11";

function ActionMessage({ state }: { state: SavedMotorcycleActionState }) {
  return <FormMessage error={state.error ?? null} success={state.success ?? null} />;
}

function removalDescription(saved: SavedMotorcycle) {
  const nextPrimary = saved.isPrimary ? " A próxima moto salva vira a principal." : "";
  return `A ${saved.manufacturer} ${saved.model} sai da sua garagem.${nextPrimary} Você pode adicioná-la de novo quando quiser.`;
}

function SavedMotorcycleCard({ saved, fitments }: { saved: SavedMotorcycle; fitments: FitmentOption[] }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useServerActionState(
    changeSavedMotorcycleAction.bind(null, saved.id),
    initialState,
  );
  const [primaryState, primaryAction, primaryPending] = useServerActionState(
    setPrimarySavedMotorcycleAction.bind(null, saved.id),
    initialState,
  );

  return (
    <article className="border-border bg-card rounded-2xl border p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="bg-moto-brand-surface text-brand-strong flex size-12 shrink-0 items-center justify-center rounded-xl">
          <Motorbike aria-hidden="true" className="size-6" />
        </div>
        <div className="@container min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-sans text-lg font-semibold tracking-normal">
              {saved.manufacturer} {saved.model}
            </h2>
            {saved.isPrimary ? (
              <Badge variant="brand">
                <Star aria-hidden="true" data-icon="inline-start" /> Principal
              </Badge>
            ) : null}
          </div>
          <MotorcycleDetails saved={saved} />
          <MotorcycleAvailability saved={saved} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {saved.available && saved.compatibleProductCount > 0 ? (
          <Link
            href={`/products?moto=${encodeURIComponent(saved.motorcycleFitmentId)}`}
            className={buttonVariants({ className: "px-4 font-semibold" })}
          >
            Ver peças compatíveis
          </Link>
        ) : null}
        {!saved.isPrimary && saved.available ? (
          <form action={primaryAction}>
            <Button pending={primaryPending} pendingLabel="Atualizando…" type="submit" variant="outline">
              Definir como principal
            </Button>
          </form>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing((current) => !current)}
          aria-expanded={editing}
        >
          {editing ? "Cancelar edição" : "Editar"}
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              variant="outline"
              aria-label={`Remover ${saved.label}`}
              className="text-destructive hover:bg-destructive/10"
            >
              Remover
            </Button>
          }
          title="Remover moto?"
          description={removalDescription(saved)}
          confirmLabel="Remover moto"
          pendingLabel="Removendo..."
          tone="destructive"
          onConfirm={() => removeSavedMotorcycleAction(saved.id, initialState)}
        />
      </div>

      {editing ? (
        <form action={editAction} className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="min-w-0 space-y-2 text-sm font-medium">
            Nova configuração
            <DesignSelect
              key={`${saved.id}-${saved.available}-${saved.motorcycleFitmentId}`}
              aria-label="Nova configuração"
              className={inputClassName}
              name="motorcycleFitmentId"
              defaultValue={saved.available ? saved.motorcycleFitmentId : ""}
              required
            >
              <option value="">Selecione fabricante, modelo, versão e ano</option>
              {fitments.map((fitment) => (
                <option key={fitment.id} value={fitment.id}>
                  {fitment.label}
                </option>
              ))}
            </DesignSelect>
          </label>
          <Button pending={editPending} pendingLabel="Salvando…" size="lg" type="submit" className="min-h-11">
            Salvar alteração
          </Button>
          <ActionMessage state={editState} />
        </form>
      ) : null}
      <div className="mt-3 space-y-1" aria-live="polite">
        <ActionMessage state={primaryState} />
      </div>
    </article>
  );
}

function MotorcycleDetails({ saved }: { saved: SavedMotorcycle }) {
  const details = [
    { label: "Fabricante", value: saved.manufacturer },
    { label: "Modelo", value: saved.model },
    { label: "Versão", value: saved.version || "Padrão" },
    { label: "Ano", value: String(saved.year) },
  ];

  return (
    // Sized by the card, not the screen: beside the account menu and the "Adicionar moto" form the
    // card can be narrow, and "FABRICANTE" would overflow into the next label. One column below
    // 16rem, two above; never four.
    <dl className="mt-3 grid grid-cols-1 gap-y-3 @[16rem]:grid-cols-2 @[16rem]:gap-x-6">
      {details.map((detail) => (
        <div key={detail.label} className="min-w-0">
          <dt className="eyebrow text-muted-foreground">{detail.label}</dt>
          <dd className="text-foreground mt-0.5 text-sm font-medium break-words">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MotorcycleAvailability({ saved }: { saved: SavedMotorcycle }) {
  if (!saved.available)
    return <p className="text-muted-foreground mt-3 text-sm">Configuração indisponível para novas buscas</p>;
  if (saved.compatibleProductCount === 0)
    return <p className="text-muted-foreground mt-3 text-sm">Não encontramos nenhum equipamento para esta moto.</p>;

  return null;
}

export function MotorcycleGarage({
  fitments,
  savedMotorcycles,
}: {
  fitments: FitmentOption[];
  savedMotorcycles: SavedMotorcycle[];
}) {
  const [state, formAction, pending] = useServerActionState(addSavedMotorcycleAction, initialState);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,360px)] lg:items-start">
      <section className="space-y-4" aria-label="Motos salvas">
        {savedMotorcycles.length ? (
          savedMotorcycles.map((saved) => <SavedMotorcycleCard key={saved.id} saved={saved} fitments={fitments} />)
        ) : (
          <EmptyState
            icon={Motorbike}
            title="Sua garagem está vazia"
            description="Salve sua moto para voltar às peças com compatibilidade cadastrada sempre que quiser."
          />
        )}
      </section>

      <section
        className="border-border bg-card rounded-2xl border p-5 shadow-sm sm:p-6"
        aria-labelledby="add-motorcycle-title"
      >
        <div className="flex items-center gap-2">
          <Plus aria-hidden="true" className="text-brand-strong size-5" />
          <h2 id="add-motorcycle-title" className="section-title text-foreground">
            Adicionar moto
          </h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Escolha uma configuração da base oficial. A primeira moto salva vira a principal.
        </p>
        <form action={formAction} className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            Fabricante, modelo, versão e ano
            <DesignSelect
              aria-label="Fabricante, modelo, versão e ano"
              className={inputClassName}
              name="motorcycleFitmentId"
              defaultValue=""
              required
            >
              <option value="">Selecione sua moto</option>
              {fitments.map((fitment) => (
                <option key={fitment.id} value={fitment.id}>
                  {fitment.label}
                </option>
              ))}
            </DesignSelect>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <DesignCheckbox className="mt-1" name="makePrimary" />
            Definir como minha moto principal
          </label>
          <Button
            size="lg"
            type="submit"
            disabled={pending || fitments.length === 0}
            className="flex min-h-11 w-full items-center justify-center gap-2 px-4"
          >
            {pending ? "Salvando..." : "Salvar moto"}
          </Button>
          {fitments.length === 0 ? (
            <p className="text-muted-foreground text-sm">A base de motos ainda não tem configurações disponíveis.</p>
          ) : null}
          <ActionMessage state={state} />
        </form>
      </section>
    </div>
  );
}
