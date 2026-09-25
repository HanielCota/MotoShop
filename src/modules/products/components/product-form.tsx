"use client";

import { startTransition, useActionState, useState } from "react";

import { createProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";
import { formatPriceInputFromCents } from "@/modules/products/domain/price-input";
import { type Measurements } from "../domain/product-commercial-fields";
import { MeasurementFields } from "./measurement-fields";

type Option = { id: string; name: string };
type FitmentOption = { id: string; label: string };

const initialState: ProductActionState = {};
const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function ProductForm({
  categories,
  brands,
  fitments,
}: {
  categories: Option[];
  brands: Option[];
  fitments: FitmentOption[];
}) {
  const [state, action, pending] = useActionState(createProductAction, initialState);

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
        <input className={inputClassName} name="name" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Slug <input className={inputClassName} name="slug" placeholder="capacete-fox-v1" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Descrição
        <textarea
          className="border-input bg-background focus:ring-ring/40 min-h-28 rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Categoria
        <select className={inputClassName} name="categoryId" required>
          <option value="">Selecione</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Marca
        <select className={inputClassName} name="brandId" required>
          <option value="">Selecione</option>
          {brands.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Compatibilidade com motos
        <select className={inputClassName + " min-h-32 py-2"} name="motorcycleFitmentIds" multiple>
          {fitments.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {fitment.label}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-xs">Use Ctrl/Cmd para selecionar mais de uma moto.</span>
      </label>
      <MeasurementFields />
      <VariantsEditor initialVariants={[{ key: "new-variant", title: "", sku: "", priceInCents: "", stock: "" }]} />
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
        {pending ? "Salvando..." : "Criar rascunho"}
      </button>
    </form>
  );
}

export type VariantDraft = Measurements & {
  key: string;
  id?: string;
  title: string;
  sku: string;
  priceInCents: number | string;
  stock: number | string;
  promotionalPriceInCents?: number | null;
  promotionStartsAt?: string;
  promotionEndsAt?: string;
};

export function VariantsEditor({ initialVariants }: { initialVariants: VariantDraft[] }) {
  const [variants, setVariants] = useState(initialVariants);

  function addVariant() {
    setVariants((current) => [
      ...current,
      { key: `new-${Date.now()}`, title: "", sku: "", priceInCents: "", stock: "" },
    ]);
  }

  function removeVariant(key: string) {
    setVariants((current) => (current.length === 1 ? current : current.filter((variant) => variant.key !== key)));
  }

  return (
    <fieldset className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <legend className="text-sm font-medium">Variações</legend>
          <p className="text-muted-foreground mt-1 text-xs">Cada variação possui SKU, preço e estoque próprios.</p>
        </div>
        <button type="button" onClick={addVariant} className="rounded-md border px-3 py-2 text-xs font-medium">
          Adicionar variação
        </button>
      </div>
      <div className="space-y-3">
        {variants.map((variant, index) => (
          <div key={variant.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <input type="hidden" name="variantId" value={variant.id ?? ""} readOnly />
            <label className="flex flex-col gap-2 text-xs font-medium">
              Variação {index + 1}
              <input
                className={inputClassName}
                name="variantTitle"
                defaultValue={variant.title}
                placeholder="Tamanho M / Preto"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              SKU
              <input className={inputClassName} name="sku" defaultValue={variant.sku} required />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Preço (R$)
              <input
                className={inputClassName}
                name="price"
                type="text"
                inputMode="decimal"
                placeholder="899,90"
                defaultValue={
                  typeof variant.priceInCents === "number"
                    ? formatPriceInputFromCents(variant.priceInCents)
                    : variant.priceInCents
                }
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Estoque
              <input
                className={inputClassName}
                name="stock"
                type="number"
                min="0"
                defaultValue={variant.stock}
                required
              />
            </label>
            <fieldset className="grid min-w-0 gap-3 rounded-lg border p-3 sm:col-span-4 sm:grid-cols-3">
              <legend className="px-1 text-sm font-medium">Promoção da variação {index + 1}</legend>
              <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
                Preço promocional (R$)
                <input
                  className={inputClassName}
                  name="promotionalPrice"
                  inputMode="decimal"
                  placeholder="Opcional"
                  defaultValue={
                    variant.promotionalPriceInCents == null
                      ? ""
                      : formatPriceInputFromCents(variant.promotionalPriceInCents)
                  }
                />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
                Início da promoção
                <input
                  className={inputClassName + " min-w-0"}
                  name="promotionStartsAt"
                  type="datetime-local"
                  defaultValue={variant.promotionStartsAt ?? ""}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
                Término da promoção
                <input
                  className={inputClassName + " min-w-0"}
                  name="promotionEndsAt"
                  type="datetime-local"
                  defaultValue={variant.promotionEndsAt ?? ""}
                />
              </label>
              <p className="text-muted-foreground text-xs sm:col-span-3">
                Horários em UTC−03:00 (Brasília). Sem início: imediata. Sem término: sem prazo. Para remover, limpe o
                preço promocional e as datas.
              </p>
            </fieldset>
            <div className="min-w-0 sm:col-span-4">
              <MeasurementFields values={variant} variant />
            </div>
            <button
              type="button"
              onClick={() => removeVariant(variant.key)}
              disabled={variants.length === 1}
              className="text-destructive justify-self-start text-xs font-medium underline underline-offset-4 disabled:opacity-40 sm:col-span-4"
            >
              Remover variação
            </button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
