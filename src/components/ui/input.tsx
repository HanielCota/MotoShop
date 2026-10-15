import type { ComponentProps } from "react";

import { fieldSizeClasses, type FieldSize } from "@/components/ui/field-size";
import { cn } from "@/lib/utils";

type InputProps = Omit<ComponentProps<"input">, "size"> & { size?: FieldSize | undefined };

export function Input({ className, type = "text", size = "default", ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      data-size={size}
      type={type}
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground w-full min-w-0 rounded-md border px-3 text-base transition-colors outline-none sm:text-sm",
        fieldSizeClasses[size],
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-3",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
