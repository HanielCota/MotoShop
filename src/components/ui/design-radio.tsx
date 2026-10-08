"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DesignRadioGroup({
  children,
  name,
  value,
  onValueChange,
  disabled,
  label,
  className,
}: {
  children: ReactNode;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <RadioGroup
      aria-label={label}
      name={name}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      className={className}
    >
      {children}
    </RadioGroup>
  );
}

export function DesignRadio({ value, disabled, className }: { value: string; disabled?: boolean; className?: string }) {
  return (
    <Radio.Root
      value={value}
      disabled={disabled}
      className={cn(
        "border-input bg-background data-checked:border-brand-strong data-checked:text-brand-strong flex size-4 shrink-0 items-center justify-center rounded-full border",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
    >
      <Radio.Indicator className="data-unchecked:hidden before:block before:size-2 before:rounded-full before:bg-current" />
    </Radio.Root>
  );
}
