"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DesignSelect } from "@/components/ui/design-select";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import { createProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import type { ProductInput } from "@/modules/products/schemas/product-input";

import { MeasurementFields } from "./measurement-fields";
import {
  productFormSchema,
  toProductFormData,
  toProductFormValues,
  toVariantFormValues,
  type ProductFormValues,
  type VariantFormValues,
} from "./product-form-model";

export type { VariantDraft } from "./product-form-model";

type Option = { id: string; name: string; slug: string };
type FitmentOption = { id: string; label: string };
export type ProductFormOptions = { categories: Option[]; brands: Option[]; fitments: FitmentOption[] };

const initialState: ProductActionState = {};

export function ProductForm({ categories, brands, fitments }: ProductFormOptions) {
  const [state, action, pending] = useActionState(createProductAction, initialState);

  return (
    <ProductFormFields
      defaultValues={toProductFormValues()}
      options={{ categories, brands, fitments }}
      dispatch={action}
      pending={pending}
      state={state}
      submitLabel="Criar rascunho"
      intro
    />
  );
}

/** Corpo compartilhado entre criação e edição. Envia o FormData no contrato de `parseProductForm`. */
export function ProductFormFields({
  defaultValues,
  options,
  dispatch,
  pending,
  state,
  submitLabel,
  intro = false,
  slugLocked = false,
  hiddenFields = {},
}: {
  defaultValues: ProductFormValues;
  options: ProductFormOptions;
  dispatch: (formData: FormData) => void;
  pending: boolean;
  state: ProductActionState;
  submitLabel: string;
  intro?: boolean;
  /** Em produtos existentes o slug não é regenerado a partir do nome (evita quebrar URLs). */
  slugLocked?: boolean;
  hiddenFields?: Record<string, string>;
}) {
  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const [slugEdited, setSlugEdited] = useState(slugLocked || Boolean(defaultValues.slug));

  const nameField = register("name", {
    onChange: (event: { target: { value: string } }) => {
      if (!slugEdited) setValue("slug", slugify(event.target.value), { shouldValidate: isSubmitted });
    },
  });
  const slugField = register("slug", {
    onChange: (event: { target: { value: string } }) => setSlugEdited(event.target.value.trim() !== ""),
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(() => {
        const formData = toProductFormData(getValues(), hiddenFields);
        startTransition(() => dispatch(formData));
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} readOnly />
      ))}
      {intro ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg p-3 text-sm leading-6 sm:col-span-2">
          Campos marcados com * são obrigatórios para salvar o rascunho. Comece pelas informações básicas e complete
          preço e estoque na seção Variações.
        </p>
      ) : null}
      <h2 className="border-b pb-2 text-base font-semibold sm:col-span-2">Informações básicas</h2>
      <FormField id="product-name" label="Nome" required error={errors.name?.message} className="sm:col-span-2">
        {(field) => <Input {...field} {...nameField} autoComplete="off" />}
      </FormField>
      <FormField
        id="product-slug"
        label="Slug"
        required
        error={errors.slug?.message}
        hint={
          slugLocked
            ? "Alterar o slug muda o endereço público do produto."
            : "Gerado a partir do nome; você pode editar."
        }
      >
        {(field) => <Input {...field} {...slugField} placeholder="capacete-fox-v1" autoComplete="off" />}
      </FormField>
      <FormField
        id="product-description"
        label="Descrição"
        required
        error={errors.description?.message}
        className="sm:col-span-2"
      >
        {(field) => <Textarea {...field} {...register("description")} />}
      </FormField>
      <FormField id="product-category" label="Categoria" required error={errors.categoryId?.message}>
        {(field) => (
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { value, onChange } }) => (
              <DesignSelect {...field} value={value} onValueChange={(next) => onChange(String(next))}>
                <option value="">Selecione</option>
                {options.categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {getCategoryLabel(option)}
                  </option>
                ))}
              </DesignSelect>
            )}
          />
        )}
      </FormField>
      <FormField id="product-brand" label="Marca" required error={errors.brandId?.message}>
        {(field) => (
          <Controller
            control={control}
            name="brandId"
            render={({ field: { value, onChange } }) => (
              <DesignSelect {...field} value={value} onValueChange={(next) => onChange(String(next))}>
                <option value="">Selecione</option>
                {options.brands.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </DesignSelect>
            )}
          />
        )}
      </FormField>
      <h2 className="border-b pb-2 text-base font-semibold sm:col-span-2">Aplicação e envio</h2>
      <FormField
        id="product-fitments"
        label="Compatibilidade com motos"
        hint="Selecione uma ou mais motos; não é preciso usar Ctrl/Cmd."
        error={errors.motorcycleFitmentIds?.message}
        className="sm:col-span-2"
      >
        {(field) => (
          <Controller
            control={control}
            name="motorcycleFitmentIds"
            render={({ field: { value, onChange } }) => (
              <DesignSelect
                {...field}
                multiple
                value={value}
                onValueChange={(next) => onChange(Array.isArray(next) ? next : [next])}
              >
                {options.fitments.map((fitment) => (
                  <option key={fitment.id} value={fitment.id}>
                    {fitment.label}
                  </option>
                ))}
              </DesignSelect>
            )}
          />
        )}
      </FormField>
      <details
        open={hasMeasurements(defaultValues) || hasMeasurementErrors(errors)}
        className="rounded-lg border p-3 sm:col-span-2"
      >
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          Dados de embalagem{" "}
          <span className="text-muted-foreground ml-1 text-sm font-normal">
            {intro ? "(opcional no rascunho)" : "(opcional)"}
          </span>
        </summary>
        <div className="mt-3">
          <MeasurementFields register={register} errors={errors} />
        </div>
      </details>
      <h2 className="border-b pb-2 text-base font-semibold sm:col-span-2">Variações</h2>
      <VariantsEditor control={control} register={register} errors={errors} />
      <FormMessage error={state.error ?? null} success={state.success ?? null} className="sm:col-span-2" />
      <Button type="submit" size="lg" className="sm:col-span-2" disabled={pending}>
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

function VariantsEditor({
  control,
  register,
  errors,
}: {
  control: Control<ProductFormValues, unknown, ProductInput>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
}) {
  // `keyName` evita colidir com o campo `id` (id da variação no banco).
  const { fields, append, remove } = useFieldArray({ control, name: "variants", keyName: "fieldKey" });

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">Cada variação possui SKU, preço e estoque próprios.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => append(toVariantFormValues())}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Adicionar variação
        </Button>
      </div>
      {(errors.variants?.root?.message ?? errors.variants?.message) ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {errors.variants?.root?.message ?? errors.variants?.message}
        </p>
      ) : null}
      {fields.map((field, index) => {
        const variantErrors = errors.variants?.[index];
        const fieldId = (name: keyof VariantFormValues) => `product-variant-${index}-${name}`;
        return (
          <fieldset key={field.fieldKey} className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <legend className="px-1 text-sm font-semibold">Variação {index + 1}</legend>
            <input type="hidden" {...register(`variants.${index}.id`)} />
            <FormField id={fieldId("title")} label="Nome da variação" required error={variantErrors?.title?.message}>
              {(control) => (
                <Input {...control} {...register(`variants.${index}.title`)} placeholder="Tamanho M / Preto" />
              )}
            </FormField>
            <FormField id={fieldId("sku")} label="SKU" required error={variantErrors?.sku?.message}>
              {(control) => <Input {...control} {...register(`variants.${index}.sku`)} autoComplete="off" />}
            </FormField>
            <FormField
              id={fieldId("priceInCents")}
              label="Preço (R$)"
              required
              error={variantErrors?.priceInCents?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  {...register(`variants.${index}.priceInCents`)}
                  inputMode="decimal"
                  placeholder="899,90"
                />
              )}
            </FormField>
            <FormField id={fieldId("stock")} label="Estoque" required error={variantErrors?.stock?.message}>
              {(control) => (
                <Input
                  {...control}
                  {...register(`variants.${index}.stock`)}
                  type="number"
                  inputMode="numeric"
                  min="0"
                />
              )}
            </FormField>
            <details
              open={Boolean(
                field.promotionalPriceInCents ||
                field.promotionStartsAt ||
                field.promotionEndsAt ||
                variantErrors?.promotionalPriceInCents ||
                variantErrors?.promotionStartsAt ||
                variantErrors?.promotionEndsAt,
              )}
              className="sm:col-span-4"
            >
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                Promoção <span className="text-muted-foreground ml-1 font-normal">(opcional)</span>
              </summary>
              <fieldset className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-3">
                <legend className="px-1 text-sm font-medium">Promoção da variação {index + 1}</legend>
                <FormField
                  id={fieldId("promotionalPriceInCents")}
                  label="Preço promocional (R$)"
                  error={variantErrors?.promotionalPriceInCents?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      {...register(`variants.${index}.promotionalPriceInCents`)}
                      inputMode="decimal"
                      placeholder="Opcional"
                    />
                  )}
                </FormField>
                <FormField
                  id={fieldId("promotionStartsAt")}
                  label="Início da promoção"
                  error={variantErrors?.promotionStartsAt?.message}
                >
                  {(control) => (
                    <Input {...control} {...register(`variants.${index}.promotionStartsAt`)} type="datetime-local" />
                  )}
                </FormField>
                <FormField
                  id={fieldId("promotionEndsAt")}
                  label="Término da promoção"
                  error={variantErrors?.promotionEndsAt?.message}
                >
                  {(control) => (
                    <Input {...control} {...register(`variants.${index}.promotionEndsAt`)} type="datetime-local" />
                  )}
                </FormField>
                <p className="text-muted-foreground text-xs sm:col-span-3">
                  Horários em UTC−03:00 (Brasília). Sem início: imediata. Sem término: sem prazo. Para remover, limpe o
                  preço promocional e as datas.
                </p>
              </fieldset>
            </details>
            <details open={hasMeasurements(field)} className="min-w-0 sm:col-span-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                Embalagem desta variação <span className="text-muted-foreground ml-1 font-normal">(opcional)</span>
              </summary>
              <MeasurementFields register={register} errors={errors} variantIndex={index} />
            </details>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              className="text-destructive hover:text-destructive justify-self-start sm:col-span-4"
            >
              <Trash2 aria-hidden="true" data-icon="inline-start" />
              Remover variação
            </Button>
          </fieldset>
        );
      })}
    </div>
  );
}

type MeasurementLike = Pick<
  ProductFormValues,
  "weightInGrams" | "heightInMillimeters" | "widthInMillimeters" | "lengthInMillimeters"
>;

function hasMeasurements(values: MeasurementLike) {
  return Boolean(
    values.weightInGrams || values.heightInMillimeters || values.widthInMillimeters || values.lengthInMillimeters,
  );
}

function hasMeasurementErrors(errors: FieldErrors<ProductFormValues>) {
  return Boolean(
    errors.weightInGrams || errors.heightInMillimeters || errors.widthInMillimeters || errors.lengthInMillimeters,
  );
}
