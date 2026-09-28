"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import { startTransition, useActionState, useState } from "react";

import { createProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";
import { formatPriceInputFromCents } from "@/modules/products/domain/price-input";
import { type Measurements } from "../domain/product-commercial-fields";
import { MeasurementFields } from "./measurement-fields";

type Option = { id: string; name: string };
type FitmentOption = { id: string; label: string };

const initialState: ProductActionState = {};

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
        <Input name="name" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Slug <Input name="slug" placeholder="capacete-fox-v1" required />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Descrição
        <Textarea
          className="border-input bg-background focus:ring-ring/40 min-h-28 rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Categoria
        <DesignSelect aria-label="Categoria" name="categoryId" required>
          <option value="">Selecione</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Marca
        <DesignSelect aria-label="Marca" name="brandId" required>
          <option value="">Selecione</option>
          {brands.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </DesignSelect>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
        Compatibilidade com motos
        <DesignSelect aria-label="Compatibilidade com motos" name="motorcycleFitmentIds" multiple>
          {fitments.map((fitment) => (
            <option key={fitment.id} value={fitment.id}>
              {fitment.label}
            </option>
          ))}
        </DesignSelect>
        <span className="text-muted-foreground text-xs">Selecione uma ou mais motos; não é preciso usar Ctrl/Cmd.</span>
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
      <Button type="submit" className="rounded-md px-4 sm:col-span-2" disabled={pending}>
        {pending ? "Salvando..." : "Criar rascunho"}
      </Button>
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
        <Button type="button" variant="outline" size="sm" onClick={addVariant} className="rounded-md text-xs">
          Adicionar variação
        </Button>
      </div>
      <div className="space-y-3">
        {variants.map((variant, index) => (
          <div key={variant.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <input type="hidden" name="variantId" value={variant.id ?? ""} readOnly />
            <label className="flex flex-col gap-2 text-xs font-medium">
              Variação {index + 1}
              <Input name="variantTitle" defaultValue={variant.title} placeholder="Tamanho M / Preto" required />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              SKU
              <Input name="sku" defaultValue={variant.sku} required />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Preço (R$)
              <Input
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
              <Input name="stock" type="number" min="0" defaultValue={variant.stock} required />
            </label>
            <fieldset className="grid min-w-0 gap-3 rounded-lg border p-3 sm:col-span-4 sm:grid-cols-3">
              <legend className="px-1 text-sm font-medium">Promoção da variação {index + 1}</legend>
              <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
                Preço promocional (R$)
                <Input
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
                <Input name="promotionStartsAt" type="datetime-local" defaultValue={variant.promotionStartsAt ?? ""} />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-xs font-medium">
                Término da promoção
                <Input name="promotionEndsAt" type="datetime-local" defaultValue={variant.promotionEndsAt ?? ""} />
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
