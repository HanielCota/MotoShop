"use client";
import { Button } from "@/components/ui/button";

import { DesignCheckbox } from "@/components/ui/design-checkbox";

import { DesignSelect } from "@/components/ui/design-select";

import Link from "next/link";
import { Bike, CheckCircle2, Plus, Star } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { useActionState, useState } from "react";

import {
  addSavedMotorcycleAction,
  changeSavedMotorcycleAction,
  removeSavedMotorcycleAction,
  setPrimarySavedMotorcycleAction,
  type SavedMotorcycleActionState,
} from "../actions/saved-motorcycle-actions";

type FitmentOption = { id: string; label: string };
type SavedMotorcycle = {
  id: string;
  motorcycleFitmentId: string;
  label: string;
  isPrimary: boolean;
  available: boolean;
};

const initialState: SavedMotorcycleActionState = {};
const inputClassName = "h-11";

function ActionMessage({ state }: { state: SavedMotorcycleActionState }) {
  return <FormMessage error={state.error ?? null} success={state.success ?? null} />;
}

function SavedMotorcycleCard({ saved, fitments }: { saved: SavedMotorcycle; fitments: FitmentOption[] }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(
    changeSavedMotorcycleAction.bind(null, saved.id),
    initialState,
  );
  const [primaryState, primaryAction, primaryPending] = useActionState(
    setPrimarySavedMotorcycleAction.bind(null, saved.id),
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSavedMotorcycleAction.bind(null, saved.id),
    initialState,
  );

  return (
    <article className="border-border bg-card rounded-2xl border p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="bg-moto-brand-surface text-brand-strong flex size-12 shrink-0 items-center justify-center rounded-xl">
          <Bike aria-hidden="true" className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-sans text-lg font-semibold tracking-normal">{saved.label}</h2>
            {saved.isPrimary ? (
              <span className="bg-moto-brand-surface text-brand-strong inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                <Star aria-hidden="true" className="size-3.5" /> Principal
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {saved.available ? "Configuração cadastrada pelo Moto Shop" : "Configuração indisponível para novas buscas"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {saved.available ? (
          <Link
            href={`/products?moto=${encodeURIComponent(saved.motorcycleFitmentId)}`}
            className={buttonVariants({ className: "px-4 font-semibold" })}
          >
            Ver peças compatíveis
          </Link>
        ) : null}
        {!saved.isPrimary && saved.available ? (
          <form action={primaryAction}>
            <Button type="submit" variant="outline" disabled={primaryPending} className="px-4">
              {primaryPending ? "Atualizando..." : "Definir como principal"}
            </Button>
          </form>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing((current) => !current)}
          aria-expanded={editing}
          className="px-4"
        >
          {editing ? "Cancelar edição" : "Editar"}
        </Button>
        <form action={removeAction}>
          <Button
            type="submit"
            variant="outline"
            disabled={removePending}
            aria-label={`Remover ${saved.label}`}
            className="text-destructive hover:bg-destructive/10 px-4"
          >
            {removePending ? "Removendo..." : "Remover"}
          </Button>
        </form>
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
          <Button size="lg" type="submit" disabled={editPending} className="min-h-11 rounded-md px-5 font-semibold">
            {editPending ? "Salvando..." : "Salvar alteração"}
          </Button>
          <ActionMessage state={editState} />
        </form>
      ) : null}
      <div className="mt-3 space-y-1" aria-live="polite">
        <ActionMessage state={primaryState} />
        <ActionMessage state={removeState} />
      </div>
    </article>
  );
}

export function MotorcycleGarage({
  fitments,
  savedMotorcycles,
}: {
  fitments: FitmentOption[];
  savedMotorcycles: SavedMotorcycle[];
}) {
  const [state, formAction, pending] = useActionState(addSavedMotorcycleAction, initialState);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,360px)] lg:items-start">
      <section className="space-y-4" aria-label="Motos salvas">
        {savedMotorcycles.length ? (
          savedMotorcycles.map((saved) => <SavedMotorcycleCard key={saved.id} saved={saved} fitments={fitments} />)
        ) : (
          <EmptyState
            icon={Bike}
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
          <h2 id="add-motorcycle-title" className="text-foreground text-lg font-semibold">
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
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 font-semibold"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
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
