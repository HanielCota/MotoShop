"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { startTransition, useState } from "react";
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
import { Disclosure } from "@/components/ui/disclosure";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import { createProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import type { ProductInput } from "@/modules/products/schemas/product-input";
import {
  VARIANT_ATTRIBUTE_MAX_LENGTH,
  variantGenderLabels,
  variantGenderValues,
} from "@/modules/products/domain/variant-attributes";

import { MeasurementFields } from "./measurement-fields";
import { PromotionDateTimeField } from "./promotion-date-time-field";
import {
  productFormSchema,
  toProductFormData,
  toProductFormValues,
  toVariantFormValues,
  type ProductFormValues,
  type VariantFormValues,
} from "./product-form-model";
import { useServerActionState } from "@/shared/forms/server-action-submit";

export type { VariantDraft } from "./product-form-model";

type Option = { id: string; name: string; slug: string };
type FitmentOption = { id: string; label: string };
export type ProductFormOptions = { categories: Option[]; brands: Option[]; fitments: FitmentOption[] };

const initialState: ProductActionState = {};

export function ProductForm({ categories, brands, fitments }: ProductFormOptions) {
  const [state, action, pending] = useServerActionState(createProductAction, initialState);

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
  // Once open (by "Alterar" or by an error), the address stays open while the seller fixes it.
  const [slugSectionOpened, setSlugSectionOpened] = useState(false);
  if (errors.slug != null && slugSectionOpened === false) setSlugSectionOpened(true);

  const nameField = register("name", {
    onChange: (event: { target: { value: string } }) => {
      if (!slugEdited) setValue("slug", slugify(event.target.value), { shouldValidate: isSubmitted });
    },
  });
  const slugField = register("slug", {
    onChange: (event: { target: { value: string } }) => setSlugEdited(event.target.value.trim() !== ""),
  });

  const slugFormField = (
    <FormField
      id="product-slug"
      label="Endereço da página"
      required
      error={errors.slug?.message}
      hint={
        slugLocked
          ? "Mudar o endereço muda o link público do produto."
          : "Aparece no link do produto, como /products/capacete-fox-v1. Preenchido a partir do nome; você pode editar."
      }
    >
      {(field) => <Input {...field} {...slugField} placeholder="Ex.: capacete-fox-v1" autoComplete="off" />}
    </FormField>
  );

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
      {intro ? <NewProductSteps /> : null}
      <h2 className="border-b pb-2 text-base font-semibold sm:col-span-2">Informações básicas</h2>
      <FormField id="product-name" label="Nome" required error={errors.name?.message} className="sm:col-span-2">
        {(field) => <Input {...field} {...nameField} autoComplete="off" />}
      </FormField>
      {slugLocked ? (
        slugFormField
      ) : (
        // A new product's address comes from the name; the field only opens to change it or to show its error.
        <details
          className="group -mt-2 text-sm sm:col-span-2"
          open={slugSectionOpened}
          onToggle={(event) => setSlugSectionOpened(event.currentTarget.open)}
        >
          <summary className="text-muted-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Endereço da página: criado a partir do nome.{" "}
            <span className="text-brand-strong underline underline-offset-4 group-open:hidden">Alterar</span>
          </summary>
          <div className="mt-3 max-w-md">{slugFormField}</div>
        </details>
      )}
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
        hint="Selecione uma ou mais motos."
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
      <Disclosure
        variant="section"
        defaultOpen={hasMeasurements(defaultValues) || hasMeasurementErrors(errors)}
        className="sm:col-span-2"
        summary={
          <>
            Dados de embalagem{" "}
            <span className="text-muted-foreground font-normal">{intro ? "(opcional no rascunho)" : "(opcional)"}</span>
          </>
        }
      >
        <MeasurementFields register={register} errors={errors} />
      </Disclosure>
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
      <p className="text-muted-foreground text-sm">Cada variação possui SKU, preço e estoque próprios.</p>
      <FormMessage
        variant="inline"
        error={errors.variants?.root?.message ?? errors.variants?.message ?? null}
        className="text-xs font-medium"
      />
      {fields.map((field, index) => {
        const variantErrors = errors.variants?.[index];
        const fieldId = (name: keyof VariantFormValues) => `product-variant-${index}-${name}`;
        return (
          <fieldset key={field.fieldKey} className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-4">
            <legend className="px-1 text-sm font-semibold">Variação {index + 1}</legend>
            <input type="hidden" {...register(`variants.${index}.id`)} />
            <FormField id={fieldId("title")} label="Nome da variação" required error={variantErrors?.title?.message}>
              {(control) => (
                <Input {...control} {...register(`variants.${index}.title`)} placeholder="Ex.: Tamanho M / Preto" />
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
                  placeholder="Ex.: 899,90"
                />
              )}
            </FormField>
            <FormField id={fieldId("stock")} label="Estoque" required error={variantErrors?.stock?.message}>
              {(control) => (
                <Input {...control} {...register(`variants.${index}.stock`)} inputMode="numeric" autoComplete="off" />
              )}
            </FormField>
            <VariantAttributeFields control={control} register={register} errors={variantErrors} index={index} />
            <Disclosure
              variant="section"
              defaultOpen={Boolean(
                field.promotionalPriceInCents ||
                field.promotionStartsAt ||
                field.promotionEndsAt ||
                variantErrors?.promotionalPriceInCents ||
                variantErrors?.promotionStartsAt ||
                variantErrors?.promotionEndsAt,
              )}
              className="sm:col-span-4"
              summary={
                <>
                  Promoção <span className="text-muted-foreground font-normal">(opcional)</span>
                </>
              }
            >
              <fieldset className="grid min-w-0 gap-3 sm:grid-cols-3">
                <legend className="sr-only">Promoção da variação {index + 1}</legend>
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
                <PromotionDateTimeField
                  id={fieldId("promotionStartsAt")}
                  label="Início da promoção"
                  bound="start"
                  name={`variants.${index}.promotionStartsAt`}
                  control={control}
                  error={variantErrors?.promotionStartsAt?.message}
                />
                <PromotionDateTimeField
                  id={fieldId("promotionEndsAt")}
                  label="Término da promoção"
                  bound="end"
                  name={`variants.${index}.promotionEndsAt`}
                  control={control}
                  error={variantErrors?.promotionEndsAt?.message}
                />
                <p className="text-muted-foreground text-xs sm:col-span-3">
                  Data em dia/mês/ano e hora de 0 a 23 (horário de Brasília, UTC−03:00). Hora vazia: o início vale desde
                  00:00 e o término até 23:59. Sem início: começa já. Sem término: sem prazo. Para remover, limpe o
                  preço promocional e as datas.
                </p>
              </fieldset>
            </Disclosure>
            <Disclosure
              variant="section"
              defaultOpen={hasMeasurements(field)}
              className="min-w-0 sm:col-span-4"
              summary={
                <>
                  Embalagem desta variação <span className="text-muted-foreground font-normal">(opcional)</span>
                </>
              }
            >
              <MeasurementFields register={register} errors={errors} variantIndex={index} />
            </Disclosure>
            {fields.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                className="text-destructive hover:text-destructive justify-self-start sm:col-span-4"
              >
                Remover variação
              </Button>
            ) : (
              <p className="text-muted-foreground text-xs sm:col-span-4">
                O produto precisa de pelo menos uma variação.
              </p>
            )}
          </fieldset>
        );
      })}
      {/* Abaixo da lista, onde a variação nova aparece (UX-17). */}
      <Button type="button" variant="outline" className="w-full" onClick={() => append(toVariantFormValues())}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        Adicionar variação
      </Button>
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

function VariantAttributeFields({
  control,
  register,
  errors,
  index,
}: {
  control: Control<ProductFormValues, unknown, ProductInput>;
  register: UseFormRegister<ProductFormValues>;
  errors: NonNullable<FieldErrors<ProductFormValues>["variants"]>[number] | undefined;
  index: number;
}) {
  const fieldId = (name: "gender" | "color" | "size") => `product-variant-${index}-${name}`;
  const optionalLabel = (label: string) => (
    <>
      {label} <span className="text-muted-foreground font-normal">(opcional)</span>
    </>
  );

  return (
    <div className="grid min-w-0 gap-3 sm:col-span-4 sm:grid-cols-3">
      <FormField id={fieldId("gender")} label={optionalLabel("Gênero")} error={errors?.gender?.message}>
        {(field) => (
          <Controller
            control={control}
            name={`variants.${index}.gender`}
            render={({ field: { value, onChange } }) => (
              <DesignSelect {...field} value={value} onValueChange={(next) => onChange(String(next))}>
                <option value="">Não informado</option>
                {variantGenderValues.map((gender) => (
                  <option key={gender} value={gender}>
                    {variantGenderLabels[gender]}
                  </option>
                ))}
              </DesignSelect>
            )}
          />
        )}
      </FormField>
      <FormField id={fieldId("color")} label={optionalLabel("Cor")} error={errors?.color?.message}>
        {(field) => (
          <Input
            {...field}
            {...register(`variants.${index}.color`)}
            maxLength={VARIANT_ATTRIBUTE_MAX_LENGTH}
            placeholder="Ex.: Preto/laranja"
          />
        )}
      </FormField>
      <FormField id={fieldId("size")} label={optionalLabel("Tamanho")} error={errors?.size?.message}>
        {(field) => (
          <Input
            {...field}
            {...register(`variants.${index}.size`)}
            maxLength={VARIANT_ATTRIBUTE_MAX_LENGTH}
            placeholder="Ex.: M ou 40"
          />
        )}
      </FormField>
    </div>
  );
}

const newProductSteps = ["Dados e variações", "Fotos", "Enviar para aprovação"] as const;

/** Photos can only be added once the draft exists, so the steps say so before the seller starts. */
function NewProductSteps() {
  return (
    <div className="bg-muted/50 grid gap-2 rounded-lg p-3 sm:col-span-2">
      <ol className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Etapas do cadastro">
        {newProductSteps.map((step, index) => {
          const current = index === 0;
          return (
            <li
              key={step}
              aria-current={current ? "step" : undefined}
              className={
                current
                  ? "flex items-center gap-2 text-sm font-semibold"
                  : "text-muted-foreground flex items-center gap-2 text-sm"
              }
            >
              <span
                aria-hidden="true"
                className={
                  current
                    ? "bg-moto-brand text-moto-brand-foreground grid size-6 place-items-center rounded-full text-xs font-bold"
                    : "bg-muted grid size-6 place-items-center rounded-full text-xs font-bold"
                }
              >
                {index + 1}
              </span>
              {step}
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground text-sm">
        Campos com * são obrigatórios. Depois de criar o rascunho, você adiciona as fotos e envia para aprovação do Moto
        Shop.
      </p>
    </div>
  );
}
