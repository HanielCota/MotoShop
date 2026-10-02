"use client";
import { Button } from "@/components/ui/button";

import { DesignCheckbox } from "@/components/ui/design-checkbox";

import { DesignSelect } from "@/components/ui/design-select";

import Link from "next/link";
import { Bike, CheckCircle2, Plus, Star } from "lucide-react";
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
  if (!state.error && !state.success) return null;
  return (
    <p role="status" className={state.error ? "text-destructive text-sm" : "text-sm text-emerald-700"}>
      {state.error ?? state.success}
    </p>
  );
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
    <article className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#fff0e7] text-[#cf4c12]">
          <Bike aria-hidden="true" className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{saved.label}</h2>
            {saved.isPrimary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0e7] px-2.5 py-1 text-xs font-semibold text-[#a63a0b]">
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
            className="inline-flex min-h-10 items-center rounded-md bg-[#1d1d1b] px-4 text-sm font-semibold text-white hover:bg-[#383835]"
          >
            Ver peças compatíveis
          </Link>
        ) : null}
        {!saved.isPrimary && saved.available ? (
          <form action={primaryAction}>
            <button
              type="submit"
              disabled={primaryPending}
              className="min-h-10 rounded-md border px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              {primaryPending ? "Atualizando..." : "Definir como principal"}
            </button>
          </form>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          aria-expanded={editing}
          className="min-h-10 rounded-md border px-4 text-sm font-medium hover:bg-slate-50"
        >
          {editing ? "Cancelar edição" : "Editar"}
        </button>
        <form action={removeAction}>
          <button
            type="submit"
            disabled={removePending}
            className="text-destructive min-h-10 rounded-md border px-4 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
          >
            {removePending ? "Removendo..." : "Remover"}
          </button>
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
          <div className="rounded-2xl border border-dashed bg-white px-6 py-10 text-center">
            <Bike aria-hidden="true" className="mx-auto size-10 text-[#cf4c12]" />
            <h2 className="mt-4 text-lg font-semibold">Sua garagem está vazia</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Salve sua moto para voltar às peças com compatibilidade cadastrada sempre que quiser.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6" aria-label="Adicionar moto">
        <div className="flex items-center gap-2 text-[#bd4814]">
          <Plus aria-hidden="true" className="size-5" />
          <h2 className="text-lg font-semibold text-slate-900">Adicionar moto</h2>
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
