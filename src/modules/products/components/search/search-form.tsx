import { Search } from "lucide-react";

import type { FieldSize } from "@/components/ui/field-size";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ProductSearchCombobox } from "./product-search-combobox";

type SearchFormProps = {
  action: string;
  /** Accessible name of the form and of the field (the label is visually hidden). */
  label: string;
  inputId: string;
  name?: string;
  placeholder: string;
  defaultValue?: string;
  /** Limits suggestions to one store. */
  sellerId?: string;
  /** Filters kept as hidden fields when a new search is sent. */
  preservedEntries?: [string, string][];
  /** Field and button share this height. */
  size?: FieldSize;
  /** On phones the button shows only the icon, keeping the field wide. */
  iconOnlyOnPhone?: boolean;
  inputClassName?: string;
  className?: string;
};

const buttonSizeByFieldSize = { sm: "sm", default: "default", lg: "lg" } as const;

/** Product search: suggestion field and "Buscar" button with the same height, inside a GET form. */
export function SearchForm({
  action,
  label,
  inputId,
  name,
  placeholder,
  defaultValue,
  sellerId,
  preservedEntries = [],
  size = "lg",
  iconOnlyOnPhone = false,
  inputClassName,
  className,
}: SearchFormProps) {
  return (
    <form action={action} method="get" role="search" aria-label={label} className={cn("flex min-w-0 gap-2", className)}>
      {preservedEntries.map(([entryName, value]) => (
        <input key={entryName} type="hidden" name={entryName} value={value} />
      ))}
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <ProductSearchCombobox
        id={inputId}
        {...(name ? { name } : {})}
        {...(defaultValue ? { defaultValue } : {})}
        {...(sellerId ? { sellerId } : {})}
        {...(inputClassName ? { inputClassName } : {})}
        className="flex-1"
        size={size}
        placeholder={placeholder}
      />
      <Button type="submit" size={buttonSizeByFieldSize[size]} className="px-5">
        <Search aria-hidden="true" />
        <span className={iconOnlyOnPhone ? "max-sm:sr-only" : undefined}>Buscar</span>
      </Button>
    </form>
  );
}
