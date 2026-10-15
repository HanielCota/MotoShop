"use client";

import { useState } from "react";
import { useController, type Control } from "react-hook-form";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { ProductInput } from "@/modules/products/schemas/product-input";

import { splitPromotionDateValue, toPromotionDateValue, type PromotionBound } from "../domain/promotion-date-input";
import type { ProductFormValues } from "./product-form-model";

type PromotionFieldName = `variants.${number}.promotionStartsAt` | `variants.${number}.promotionEndsAt`;

/**
 * Data (dia/mês/ano) e hora (0 a 23) em texto, no lugar do calendário nativo do navegador (DN-01):
 * mesmo padrão dos filtros de data e formato independente do idioma do navegador.
 */
export function PromotionDateTimeField({
  id,
  label,
  bound,
  name,
  control,
  error,
}: {
  id: string;
  label: string;
  bound: PromotionBound;
  name: PromotionFieldName;
  control: Control<ProductFormValues, unknown, ProductInput>;
  error?: string | undefined;
}) {
  const { field } = useController({ control, name });
  const [parts, setParts] = useState(() => splitPromotionDateValue(field.value));

  function update(next: { date: string; time: string }) {
    setParts(next);
    field.onChange(toPromotionDateValue(next.date, next.time, bound));
  }

  return (
    <FormField id={id} label={label} error={error}>
      {(control) => (
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <Input
            {...control}
            ref={field.ref}
            name={field.name}
            onBlur={field.onBlur}
            value={parts.date}
            onChange={(event) => update({ ...parts, date: event.target.value })}
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="dd/mm/aaaa"
          />
          <Input
            aria-label={`Hora: ${label.toLowerCase()}`}
            aria-invalid={control["aria-invalid"]}
            aria-describedby={control["aria-describedby"]}
            value={parts.time}
            onChange={(event) => update({ ...parts, time: event.target.value })}
            onBlur={field.onBlur}
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            placeholder={bound === "start" ? "00:00" : "23:59"}
          />
        </div>
      )}
    </FormField>
  );
}
