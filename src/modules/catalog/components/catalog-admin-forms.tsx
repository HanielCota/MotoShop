"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

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

function Feedback({ state }: { state: CatalogActionState }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-success-foreground text-sm">
          {state.success}
        </p>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
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
    <form action={action} noValidate className="space-y-3 rounded-lg border p-4">
      {children}
      <Button type="submit" disabled={pending} className="rounded-md font-semibold">
        {pending ? "Salvando..." : "Adicionar"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function CategoryForm({ categories }: { categories: Option[] }) {
  const [state, action, pending] = useActionState(createCategoryAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <Field label="Nome da categoria">
        <Input name="name" placeholder="Ex.: Capacetes" required />
      </Field>
      <Field label="Categoria pai">
        <DesignSelect name="parentId" defaultValue="">
          <option value="">Categoria raiz</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </DesignSelect>
      </Field>
      <Field label="Ordem de exibição">
        <Input name="sortOrder" type="number" min="0" defaultValue="0" />
      </Field>
    </FormShell>
  );
}

export function BrandForm() {
  const [state, action, pending] = useActionState(createBrandAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <Field label="Nome da marca">
        <Input name="name" placeholder="Ex.: Fox" required />
      </Field>
    </FormShell>
  );
}

export function MotorcycleManufacturerForm() {
  const [state, action, pending] = useActionState(createMotorcycleManufacturerAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <Field label="Fabricante">
        <Input name="name" placeholder="Ex.: Honda" required />
      </Field>
    </FormShell>
  );
}

export function MotorcycleModelForm({ manufacturers }: { manufacturers: Option[] }) {
  const [state, action, pending] = useActionState(createMotorcycleModelAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <Field label="Fabricante">
        <DesignSelect name="manufacturerId" required defaultValue="">
          <option value="">Selecione</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer.id} value={manufacturer.id}>
              {manufacturer.label}
            </option>
          ))}
        </DesignSelect>
      </Field>
      <Field label="Modelo">
        <Input name="name" placeholder="Ex.: CRF 250R" required />
      </Field>
    </FormShell>
  );
}

export function MotorcycleFitmentForm({ models }: { models: Option[] }) {
  const [state, action, pending] = useActionState(createMotorcycleFitmentAction, initialState);
  return (
    <FormShell action={action} state={state} pending={pending}>
      <Field label="Modelo da moto">
        <DesignSelect name="motorcycleModelId" required defaultValue="">
          <option value="">Selecione</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </DesignSelect>
      </Field>
      <Field label="Versão (opcional)">
        <Input name="version" placeholder="Ex.: Edição especial" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cilindrada (cc)">
          <Input name="displacementCc" type="number" min="1" placeholder="Ex.: 250" required />
        </Field>
        <Field label="Ano">
          <Input name="year" type="number" min="1900" max="2200" placeholder="Ex.: 2025" required />
        </Field>
      </div>
    </FormShell>
  );
}
