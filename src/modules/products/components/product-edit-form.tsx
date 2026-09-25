"use client";

import { startTransition, useActionState } from "react";

import { updateProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";

import { VariantsEditor, type VariantDraft } from "./product-form";
import { type Measurements } from "../domain/product-commercial-fields";
import { MeasurementFields } from "./measurement-fields";

type Option = { id: string; name: string };
type FitmentOption = { id: string; label: string };
type ProductValues = Measurements & {
  id: string;
  revision: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  variants: (Omit<VariantDraft, "key"> & { id: string })[];
  motorcycleFitmentIds: string[];
};

const initialState: ProductActionState = {};
const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function ProductEditForm({
  product,
  categories,
  brands,
  fitments,
}: {
  product: ProductValues;
  categories: Option[];
  brands: Option[];
  fitments: FitmentOption[];
}) {
  const [state, action, pending] = useActionState(updateProductAction.bind(null, product.id), initialState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Nome
        <input className={inputClassName} name="name" defaultValue={product.name} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Slug
        <input className={inputClassName} name="slug" defaultValue={product.slug} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Descrição
        <textarea
          className="border-input bg-background focus:ring-ring/40 min-h-28 rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          defaultValue={product.description}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Categoria
        <select className={inputClassName} name="categoryId" defaultValue={product.categoryId} required>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Marca
        <select className={inputClassName} name="brandId" defaultValue={product.brandId} required>
          {brands.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Compatibilidade com motos
        <select
          className={inputClassName + " min-h-32 py-2"}
          name="motorcycleFitmentIds"
          multiple
          defaultValue={product.motorcycleFitmentIds}
        >
          {fitments.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {fitment.label}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-xs">Use Ctrl/Cmd para selecionar mais de uma moto.</span>
      </label>
      <MeasurementFields values={product} />
      <VariantsEditor
        key={product.revision}
        initialVariants={product.variants.map((variant) => ({ ...variant, key: variant.id }))}
      />
      {state.error ? (
        <p className="text-destructive text-sm sm:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600 sm:col-span-2" role="status">
          {state.success}
        </p>
      ) : null}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50 sm:col-span-2"
        disabled={pending}
      >
        {pending ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
