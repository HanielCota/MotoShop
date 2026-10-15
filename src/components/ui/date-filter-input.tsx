import type { FieldSize } from "@/components/ui/field-size";
import { Input } from "@/components/ui/input";
import { formatDateFilter } from "@/lib/date-filter";

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
  return (
    <Input
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={10}
      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      title="Use o formato dia/mês/ano."
      placeholder="dd/mm/aaaa"
      defaultValue={formatDateFilter(value)}
      size={size}
      className={className}
    />
  );
}
