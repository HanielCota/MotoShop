import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FormFieldControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

export function formFieldIds(id: string, { hint, error }: { hint?: unknown; error?: unknown }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy };
}

/**
 * Campo de formulário acessível: rótulo, controle, dica e erro ligados por ids.
 * O controle recebe `id`, `aria-invalid` e `aria-describedby` via render prop:
 *
 * ```tsx
 * <FormField id="product-name" label="Nome" error={errors.name?.message}>
 *   {(field) => <Input {...field} {...register("name")} />}
 * </FormField>
 * ```
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  labelClassName,
  hintLive,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode | undefined;
  error?: string | null | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  labelClassName?: string | undefined;
  /** Anuncia mudanças da dica (ex.: resultado de busca de CEP). */
  hintLive?: boolean | undefined;
  children: (control: FormFieldControlProps) => ReactNode;
}) {
  const { hintId, errorId, describedBy } = formFieldIds(id, { hint, error });

  return (
    <div data-slot="form-field" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className={cn("text-sm font-medium", labelClassName)}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive ml-0.5">
            *
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} aria-live={hintLive ? "polite" : undefined} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
