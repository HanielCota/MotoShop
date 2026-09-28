"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

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
        <Input name="name" defaultValue={product.name} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Slug
        <Input name="slug" defaultValue={product.slug} required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Descrição
        <Textarea
          className="border-input bg-background focus:ring-ring/40 min-h-28 rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          defaultValue={product.description}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Categoria
        <DesignSelect
          aria-label="Categoria"
          name="categoryId"
          defaultValue={product.categoryId}
          required
        >
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Marca
        <DesignSelect
          aria-label="Marca"
          name="brandId"
          defaultValue={product.brandId}
          required
        >
          {brands.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Compatibilidade com motos
        <DesignSelect
          aria-label="Compatibilidade com motos"
          name="motorcycleFitmentIds"
          multiple
          defaultValue={product.motorcycleFitmentIds}
        >
          {fitments.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {fitment.label}
            </option>
          ))}
        </DesignSelect>
        <span className="text-muted-foreground text-xs">Selecione uma ou mais motos; não é preciso usar Ctrl/Cmd.</span>
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
      <Button type="submit" className="rounded-md px-4 sm:col-span-2" disabled={pending}>
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
