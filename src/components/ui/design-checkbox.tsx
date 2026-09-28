"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type DesignCheckboxProps = {
  name?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  className?: string;
};

export function DesignCheckbox({ name, defaultChecked, disabled, className }: DesignCheckboxProps) {
  return (
    <Checkbox.Root
      name={name}
      defaultChecked={defaultChecked}
      disabled={disabled}
      className={cn(
        "border-input bg-background data-checked:bg-primary data-checked:text-primary-foreground flex size-4 shrink-0 items-center justify-center rounded border",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
    >
      <Checkbox.Indicator className="data-unchecked:hidden">
        <Check aria-hidden="true" className="size-3" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
