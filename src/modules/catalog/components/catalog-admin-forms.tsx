"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ClientFormValidator, useClientValidation } from "@/shared/forms/client-validation";

import { DesignSelect } from "@/components/ui/design-select";

import {
  createBrandAction,
  createCategoryAction,
  createMotorcycleFitmentAction,
  createMotorcycleManufacturerAction,
  createMotorcycleModelAction,
  type CatalogActionState,
} from "../actions/admin-catalog-actions";
import { catalogFormValidators } from "../schemas/catalog-input";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type Option = { id: string; label: string };
type CatalogFormState = CatalogActionState & { values?: Record<string, string> };
type CatalogAction = (state: CatalogActionState, formData: FormData) => Promise<CatalogActionState>;
const initialState: CatalogFormState = {};

/**
 * O React limpa campos não controlados depois de uma action. Quando o servidor
 * recusa o envio, guardamos o que foi digitado para devolver aos campos.
 */
function useCatalogForm(catalogAction: CatalogAction) {
  return useServerActionState(async (previous: CatalogFormState, formData: FormData): Promise<CatalogFormState> => {
    const result = await catalogAction(previous, formData);
    if (!result.error) return result;
    return { ...result, values: readTextEntries(formData) };
  }, initialState);
}

function readTextEntries(formData: FormData) {
  const entries = [...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return Object.fromEntries(entries);
}

function Feedback({ state, clientError }: { state: CatalogActionState; clientError: string | null }) {
  const error = clientError ?? state.error;
  return (
    <>
      <FormMessage variant="inline" error={error ?? null} success={clientError ? null : (state.success ?? null)} />
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
  validate,
}: {
  children: React.ReactNode;
  action: (data: FormData) => void;
  state: CatalogFormState;
  pending: boolean;
  validate: ClientFormValidator;
}) {
  const { clientError, onSubmit } = useClientValidation(validate);
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-3 rounded-lg border p-4">
      {children}
      <Button pending={pending} pendingLabel="Salvando…" type="submit" className="rounded-md font-semibold">
        Adicionar
      </Button>
      <Feedback state={state} clientError={clientError} />
    </form>
  );
}

export function CategoryForm({ categories }: { categories: Option[] }) {
  const [state, action, pending] = useCatalogForm(createCategoryAction);
  return (
    <FormShell action={action} state={state} pending={pending} validate={catalogFormValidators.category}>
      <Field label="Nome da categoria">
        <Input name="name" placeholder="Ex.: Capacetes" defaultValue={state.values?.name ?? ""} required />
      </Field>
      <Field label="Categoria pai">
        <DesignSelect name="parentId" defaultValue={state.values?.parentId ?? ""}>
          <option value="">Categoria raiz</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </DesignSelect>
      </Field>
      <Field label="Ordem de exibição">
        <Input name="sortOrder" type="number" min="0" defaultValue={state.values?.sortOrder ?? "0"} />
      </Field>
    </FormShell>
  );
}

export function BrandForm() {
  const [state, action, pending] = useCatalogForm(createBrandAction);
  return (
    <FormShell action={action} state={state} pending={pending} validate={catalogFormValidators.brand}>
      <Field label="Nome da marca">
        <Input name="name" placeholder="Ex.: Fox" defaultValue={state.values?.name ?? ""} required />
      </Field>
    </FormShell>
  );
}

export function MotorcycleManufacturerForm() {
  const [state, action, pending] = useCatalogForm(createMotorcycleManufacturerAction);
  return (
    <FormShell action={action} state={state} pending={pending} validate={catalogFormValidators.manufacturer}>
      <Field label="Fabricante">
        <Input name="name" placeholder="Ex.: Honda" defaultValue={state.values?.name ?? ""} required />
      </Field>
    </FormShell>
  );
}

export function MotorcycleModelForm({ manufacturers }: { manufacturers: Option[] }) {
  const [state, action, pending] = useCatalogForm(createMotorcycleModelAction);
  return (
    <FormShell action={action} state={state} pending={pending} validate={catalogFormValidators.model}>
      <Field label="Fabricante">
        <DesignSelect name="manufacturerId" required defaultValue={state.values?.manufacturerId ?? ""}>
          <option value="">Selecione</option>
          {manufacturers.map((manufacturer) => (
            <option key={manufacturer.id} value={manufacturer.id}>
              {manufacturer.label}
            </option>
          ))}
        </DesignSelect>
      </Field>
      <Field label="Modelo">
        <Input name="name" placeholder="Ex.: CRF 250R" defaultValue={state.values?.name ?? ""} required />
      </Field>
    </FormShell>
  );
}

export function MotorcycleFitmentForm({ models }: { models: Option[] }) {
  const [state, action, pending] = useCatalogForm(createMotorcycleFitmentAction);
  return (
    <FormShell action={action} state={state} pending={pending} validate={catalogFormValidators.fitment}>
      <Field label="Modelo da moto">
        <DesignSelect name="motorcycleModelId" required defaultValue={state.values?.motorcycleModelId ?? ""}>
          <option value="">Selecione</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </DesignSelect>
      </Field>
      <Field label="Versão (opcional)">
        <Input name="version" placeholder="Ex.: Edição especial" defaultValue={state.values?.version ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cilindrada (cc)">
          <Input
            name="displacementCc"
            type="number"
            min="1"
            placeholder="Ex.: 250"
            defaultValue={state.values?.displacementCc ?? ""}
            required
          />
        </Field>
        <Field label="Ano">
          <Input
            name="year"
            type="number"
            min="1900"
            max="2200"
            placeholder="Ex.: 2025"
            defaultValue={state.values?.year ?? ""}
            required
          />
        </Field>
      </div>
    </FormShell>
  );
}
