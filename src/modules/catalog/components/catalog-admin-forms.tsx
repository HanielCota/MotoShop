"use client";

import { useActionState } from "react";

import {
  createBrandAction,
  createCategoryAction,
  createMotorcycleFitmentAction,
  createMotorcycleManufacturerAction,
  createMotorcycleModelAction,
  type CatalogActionState,
} from "../actions/admin-catalog-actions";

type Option = { id: string; label: string };
const initialState: CatalogActionState = {};
const inputClassName = "h-10 rounded-md border px-3 text-sm";

function Feedback({ state }: { state: CatalogActionState }) {
  return (
    <>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
    </>
  );
}

function FormShell({
  children,
  action,
  state,
  pending,
}: {
  children: React.ReactNode;
  action: (data: FormData) => void;
  state: CatalogActionState;
  pending: boolean;
}) {
  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      {children}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Adicionar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CategoryForm({ categories }: { categories: Option[] }) {
  const [state, action, pending] = useActionState(createCategoryAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <input className={inputClassName + " w-full"} name="name" placeholder="Nome da categoria" required />
      <select className={inputClassName + " w-full"} name="parentId" defaultValue="">
        <option value="">Categoria raiz</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>
      <input
        className={inputClassName + " w-full"}
        name="sortOrder"
        type="number"
        min="0"
        defaultValue="0"
        placeholder="Ordem"
      />
    </FormShell>
  );
}

export function BrandForm() {
  const [state, action, pending] = useActionState(createBrandAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <input className={inputClassName + " w-full"} name="name" placeholder="Nome da marca" required />
    </FormShell>
  );
}

export function MotorcycleManufacturerForm() {
  const [state, action, pending] = useActionState(createMotorcycleManufacturerAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <input className={inputClassName + " w-full"} name="name" placeholder="Fabricante (ex.: Honda)" required />
    </FormShell>
  );
}

export function MotorcycleModelForm({ manufacturers }: { manufacturers: Option[] }) {
  const [state, action, pending] = useActionState(createMotorcycleModelAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <select className={inputClassName + " w-full"} name="manufacturerId" required defaultValue="">
        <option value="">Fabricante</option>
        {manufacturers.map((manufacturer) => (
          <option key={manufacturer.id} value={manufacturer.id}>
            {manufacturer.label}
          </option>
        ))}
      </select>
      <input className={inputClassName + " w-full"} name="name" placeholder="Modelo (ex.: CRF 250R)" required />
    </FormShell>
  );
}

export function MotorcycleFitmentForm({ models }: { models: Option[] }) {
  const [state, action, pending] = useActionState(createMotorcycleFitmentAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <select className={inputClassName + " w-full"} name="motorcycleModelId" required defaultValue="">
        <option value="">Modelo</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
      <input className={inputClassName + " w-full"} name="version" placeholder="Versão (opcional)" />
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputClassName}
          name="displacementCc"
          type="number"
          min="1"
          placeholder="Cilindrada cc"
          required
        />
        <input className={inputClassName} name="year" type="number" min="1900" max="2200" placeholder="Ano" required />
      </div>
    </FormShell>
  );
}
