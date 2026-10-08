"use client";

import type { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute } from "react";

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { checkoutFieldId, type CheckoutField, type CheckoutFieldChange } from "./checkout-form-model";

export function CheckoutFormField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  type = "text",
  required,
  maxLength,
  inputMode,
  autoComplete,
  placeholder,
  className,
}: {
  label: string;
  name: CheckoutField;
  value: string;
  onChange: CheckoutFieldChange;
  error?: string | undefined;
  hint?: string | undefined;
  type?: HTMLInputTypeAttribute | undefined;
  required?: boolean | undefined;
  maxLength?: number | undefined;
  inputMode?: "numeric" | "tel" | "email" | "text" | undefined;
  autoComplete?: HTMLInputAutoCompleteAttribute | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <FormField id={checkoutFieldId(name)} label={label} hint={hint} hintLive error={error} className={className}>
      {(control) => (
        <Input
          {...control}
          name={name}
          type={type}
          value={value}
          required={required}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(name, event.target.value)}
        />
      )}
    </FormField>
  );
}
