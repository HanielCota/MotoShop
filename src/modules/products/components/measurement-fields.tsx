"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { measurementFields } from "../domain/product-commercial-fields";
import type { ProductFormValues } from "./product-form-model";

export function MeasurementFields({
  register,
  errors,
  variantIndex,
}: {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  /** Ausente: embalagem padrão do produto. Presente: embalagem da variação. */
  variantIndex?: number | undefined;
}) {
  const isVariant = variantIndex !== undefined;
  const fieldErrors = isVariant ? errors.variants?.[variantIndex] : errors;

  return (
    <fieldset className="grid min-w-0 gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium">
        {isVariant ? `Embalagem da variação ${variantIndex + 1}` : "Embalagem padrão para envio"}
      </legend>
      <p className="text-muted-foreground text-xs sm:col-span-2">
        {isVariant
          ? "Deixe em branco para usar o valor padrão do produto."
          : "Informe o produto já embalado. Campos opcionais no rascunho; necessários para uma cotação precisa."}{" "}
        1 kg = 1.000 g · 1 cm = 10 mm.
      </p>
      {measurementFields.map(({ name, label }) => {
        const id = isVariant ? `product-variant-${variantIndex}-${name}` : `product-${name}`;
        return (
          <FormField key={name} id={id} label={label} error={fieldErrors?.[name]?.message}>
            {(control) => (
              <Input
                {...control}
                {...register(isVariant ? (`variants.${variantIndex}.${name}` as const) : name)}
                type="number"
                inputMode="numeric"
                min="1"
                max="2147483647"
                step="1"
              />
            )}
          </FormField>
        );
      })}
    </fieldset>
  );
}
