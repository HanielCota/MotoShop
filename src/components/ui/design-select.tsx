"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type OptionProps = {
  value?: string | number;
  children?: ReactNode;
};

type DesignSelectProps = {
  children: ReactNode;
  className?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  defaultValue?: string | string[] | number;
  value?: string | string[] | number;
  onValueChange?: (value: string | string[]) => void;
  tone?: "default" | "marketing";
  "aria-label"?: string;
};

/** A form-compatible select whose open list is rendered by the installed Base UI primitive. */
export function DesignSelect({
  children,
  className,
  name,
  required,
  disabled,
  multiple,
  defaultValue,
  value,
  onValueChange,
  tone = "default",
  "aria-label": ariaLabel,
}: DesignSelectProps) {
  const options = Children.toArray(children)
    .filter((child): child is React.ReactElement<OptionProps> => isValidElement<OptionProps>(child) && child.type === "option")
    .map((option) => ({
      value: option.props.value == null ? String(option.props.children ?? "") : String(option.props.value),
      label: option.props.children,
    }));
  const emptyOption = options.find((option) => option.value === "");
  const items = options.map((option) => ({ ...option, value: option.value === "" ? null : option.value }));
  const selectedValue = Array.isArray(value) ? value : value === "" ? null : value == null ? undefined : String(value);
  const initialValue = Array.isArray(defaultValue)
    ? defaultValue
    : defaultValue === ""
      ? null
      : defaultValue == null
        ? undefined
        : String(defaultValue);

  const content = (
    <>
      <Select.Trigger
        aria-label={ariaLabel ?? name}
        className={cn(
          "border-input bg-background text-foreground flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm transition-colors",
          "hover:not-data-disabled:border-primary/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-placeholder:text-muted-foreground",
          className,
        )}
        data-slot="select-trigger"
      >
        <Select.Value placeholder={emptyOption?.label ?? "Selecione"} className="min-w-0 truncate" />
        <Select.Icon className="shrink-0 opacity-70">
          <ChevronDown aria-hidden="true" className="size-4" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-50 outline-none" sideOffset={4}>
          <Select.Popup
            className={cn(
              "border-border bg-popover text-popover-foreground min-w-[var(--anchor-width)] max-w-[min(90vw,40rem)] overflow-hidden rounded-md border shadow-lg outline-none",
              tone === "marketing" && "border-orange-200",
              "origin-[var(--transform-origin)] transition-[opacity,transform] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            )}
          >
            <Select.List className="max-h-[min(var(--available-height),18rem)] overflow-y-auto p-1 scroll-py-1">
              {items.map((item, index) => (
                <Select.Item
                  key={`${item.value ?? "empty"}-${index}`}
                  value={item.value}
                  className={cn(
                    "data-selected:font-medium grid cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none",
                    tone === "marketing"
                      ? "data-highlighted:bg-orange-600 data-highlighted:text-white"
                      : "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                  )}
                >
                  <Select.ItemIndicator className="col-start-1">
                    <Check aria-hidden="true" className="size-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText className="col-start-2 truncate">{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </>
  );

  if (multiple) {
    return (
      <Select.Root
        multiple
        items={items.filter((item): item is { value: string; label: ReactNode } => item.value !== null)}
        name={name}
        required={required}
        disabled={disabled}
        defaultValue={Array.isArray(initialValue) ? initialValue : []}
        value={Array.isArray(selectedValue) ? selectedValue : undefined}
        onValueChange={(nextValue) => onValueChange?.(nextValue)}
      >
        {content}
      </Select.Root>
    );
  }

  return (
    <Select.Root
      items={items}
      name={name}
      required={required}
      disabled={disabled}
      defaultValue={typeof initialValue === "string" ? initialValue : initialValue === null ? null : undefined}
      value={typeof selectedValue === "string" ? selectedValue : selectedValue === null ? null : undefined}
      onValueChange={(nextValue) => onValueChange?.(nextValue ?? "")}
    >
      {content}
    </Select.Root>
  );
}
