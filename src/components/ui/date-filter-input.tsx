import { useId } from "react";

import type { FieldSize } from "@/components/ui/field-size";
import { Input } from "@/components/ui/input";
import { formatDateFilter, isInvalidDateFilter } from "@/lib/date-filter";

/**
 * Date field of the GET filters. No `pattern`/`title`: the browser bubble and OS tooltip are not
 * part of the DS (DN-03, DN-09). Common ways of typing a date are accepted on the server; a value
 * that is not a date is ignored by the filter and flagged here.
 */
export function DateFilterInput({
  name,
  value,
  size,
  className,
}: {
  name: string;
  value?: string | null;
  size?: FieldSize | undefined;
  className?: string;
}) {
  const errorId = useId();
  const invalid = isInvalidDateFilter(value);

  return (
    <>
      <Input
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="dd/mm/aaaa"
        defaultValue={formatDateFilter(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        size={size}
        className={className}
      />
      {invalid ? (
        <span id={errorId} className="text-destructive text-xs font-medium">
          Data inválida, use dia/mês/ano. O filtro foi ignorado.
        </span>
      ) : null}
    </>
  );
}
